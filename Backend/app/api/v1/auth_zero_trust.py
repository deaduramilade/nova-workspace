"""
Enhanced Zero-Trust Login System for Admins
This module provides advanced authentication with device verification,
risk assessment, and multi-factor authentication based on trust levels.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import pyotp
import json

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import enforce_rate_limit
from app.core.security import hash_password, create_access_token, verify_password, get_current_user
from app.core.device_security import (
    DeviceFingerprintGenerator,
    ZeroTrustValidator,
    SessionSecurityManager,
    DeviceTrustPolicy,
)
from app.models.user import User
from app.models.device import (
    DeviceFingerprint,
    TrustedDevice,
    AdminSession,
    LoginAttempt,
)
from app.schemas.user import (
    UserCreate, UserResponse, TOTPSetupResponse, TOTPVerifyRequest, LoginMFARequest
)
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/auth/zero-trust", tags=["auth-zero-trust"])


# ============================================================================
# Pydantic Models
# ============================================================================

class ZeroTrustLoginRequest(BaseModel):
    username: str
    password: str
    device_name: Optional[str] = None
    device_fingerprint_data: Optional[dict] = None
    user_agent: str
    ip_address: str
    totp_code: Optional[str] = None


class ZeroTrustLoginResponse(BaseModel):
    access_token: str
    token_type: str
    session_id: str
    user: dict
    risk_assessment: dict
    requires_additional_verification: bool


class RiskAssessmentResponse(BaseModel):
    risk_score: int
    risk_level: str  # low, medium, high, critical
    anomalies: dict
    requires_additional_mfa: bool
    requires_admin_approval: bool
    recommendation: str
    timestamp: datetime


class VerifyAnomalyResponse(BaseModel):
    access_token: Optional[str]
    token_type: Optional[str]
    session_id: Optional[str]
    message: str
    verified: bool


# ============================================================================
# Helper Functions
# ============================================================================

def get_user_login_history(user_id: int, db: Session, limit: int = 10) -> dict:
    """Retrieve user's login history for anomaly detection"""
    recent_logins = db.query(LoginAttempt).filter(
        LoginAttempt.user_id == user_id,
        LoginAttempt.success == True,
    ).order_by(LoginAttempt.created_at.desc()).limit(limit).all()

    if not recent_logins:
        return {}

    known_ips = list(set([login.ip_address for login in recent_logins if login.ip_address]))
    known_locations = list(set([login.location for login in recent_logins if login.location]))
    
    # Extract working hours (simplified: 9-5 weekdays)
    return {
        "known_devices": [login.device_fingerprint for login in recent_logins if login.device_fingerprint],
        "last_ips": known_ips,
        "last_location": known_locations[-1] if known_locations else None,
        "working_hours": {"start": 9, "end": 17},
        "last_login": recent_logins[0].created_at if recent_logins else None,
    }


def record_login_attempt(
    user: User,
    request: Request,
    success: bool,
    reason: Optional[str] = None,
    device_id: Optional[str] = None,
    db: Session = None
):
    """Record login attempt for audit trail"""
    try:
        attempt = LoginAttempt(
            username=user.username,
            user_id=user.id,
            success=success,
            reason=reason,
            ip_address=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", ""),
            device_fingerprint=device_id,
            created_at=datetime.utcnow(),
        )
        db.add(attempt)
        db.commit()
    except Exception as e:
        print(f"Failed to record login attempt: {e}")


# ============================================================================
# Zero-Trust Login Endpoints
# ============================================================================

@router.post("/login", response_model=dict)
async def zero_trust_login(
    login_request: ZeroTrustLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Enhanced zero-trust login for admins.
    Performs device verification, risk assessment, and adaptive MFA.
    
    Steps:
    1. Verify credentials
    2. Generate device fingerprint
    3. Assess risk score
    4. Determine required MFA level
    5. Create session with appropriate permissions
    """
    enforce_rate_limit(request, bucket="auth_login", limit=settings.RATE_LIMIT_AUTH_PER_MINUTE)

    # Step 1: Verify credentials
    user = db.query(User).filter(User.username == login_request.username).first()

    if not user:
        return {
            "error": "Invalid credentials",
            "status": 401,
        }

    if not verify_password(login_request.password, user.hashed_password):
        record_login_attempt(user, request, False, "invalid_password", db=db)
        return {
            "error": "Invalid credentials",
            "status": 401,
        }

    if not user.is_active:
        record_login_attempt(user, request, False, "account_disabled", db=db)
        return {
            "error": "Account is disabled",
            "status": 403,
        }

    # Only admins can use zero-trust login
    if user.role != "admin":
        return {
            "error": "Zero-trust login available only for admins",
            "status": 403,
        }

    # Step 2: Generate device fingerprint
    device_id = DeviceFingerprintGenerator.generate_device_id(
        login_request.user_agent,
        login_request.ip_address,
        login_request.device_fingerprint_data,
    )

    device_fingerprint_hash = DeviceFingerprintGenerator.create_fingerprint_hash(
        login_request.user_agent,
        login_request.ip_address,
    )

    device_info = DeviceFingerprintGenerator.extract_device_info(login_request.user_agent)

    # Get or create device fingerprint
    device = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.device_id == device_id
    ).first()

    if not device:
        device = DeviceFingerprint(
            user_id=user.id,
            device_id=device_id,
            fingerprint_hash=device_fingerprint_hash,
            device_name=login_request.device_name or "Unknown Device",
            device_type=device_info.get("device_type", "laptop"),
            browser=device_info.get("browser", "Unknown"),
            browser_version=device_info.get("browser_version", ""),
            os=device_info.get("os", "Unknown"),
            os_version=device_info.get("os_version", ""),
            user_agent=login_request.user_agent,
            ip_address=login_request.ip_address,
            trust_level="untrusted",
            risk_score=40,
        )
        db.add(device)
        db.commit()
        db.refresh(device)

    # Check if device is blocked
    if device.blocked:
        record_login_attempt(user, request, False, "device_blocked", device_id, db=db)
        return {
            "error": "This device has been blocked",
            "status": 403,
            "reason": device.block_reason,
        }

    # Step 3: Assess risk
    is_trusted_device = device.is_trusted
    device_recently_used = (datetime.utcnow() - device.last_used).days < 30 if device.last_used else False
    
    user_history = get_user_login_history(user.id, db)
    location_matches = True  # Simplified for now
    is_working_hours = 9 <= datetime.utcnow().hour < 17  # Mon-Fri 9-5

    risk_score = ZeroTrustValidator.calculate_risk_score(
        device_trusted=is_trusted_device,
        device_recently_used=device_recently_used,
        location_matches_history=location_matches,
        time_within_working_hours=is_working_hours,
        recent_failed_attempts=0,
    )

    anomalies = ZeroTrustValidator.detect_anomalies(
        {
            "device_id": device_id,
            "location": None,
            "ip_address": login_request.ip_address,
        },
        user_history,
    )

    device.risk_score = risk_score
    device.last_used = datetime.utcnow()

    # Step 4: Determine MFA requirement
    requires_additional_mfa = ZeroTrustValidator.should_require_additional_mfa(risk_score, anomalies)
    requires_admin_approval = ZeroTrustValidator.should_require_admin_approval(risk_score)

    # If high-risk, require additional MFA
    if requires_additional_mfa and not login_request.totp_code:
        db.commit()
        return {
            "mfa_required": True,
            "risk_score": risk_score,
            "anomalies": anomalies,
            "message": "Additional verification required due to unusual login pattern",
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
            },
        }

    # Verify TOTP if required or provided
    if user.totp_enabled:
        if not login_request.totp_code:
            if not is_trusted_device or risk_score > 50:
                db.commit()
                return {
                    "mfa_required": True,
                    "risk_score": risk_score,
                    "anomalies": anomalies,
                    "message": "TOTP code required",
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "role": user.role,
                    },
                }
        else:
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(login_request.totp_code):
                record_login_attempt(user, request, False, "invalid_totp", device_id, db=db)
                return {
                    "error": "Invalid TOTP code",
                    "status": 401,
                }

    # Step 5: Create session
    session_id = SessionSecurityManager.generate_session_id()
    session_expires_at = SessionSecurityManager.calculate_session_expiry(hours=8)

    admin_session = AdminSession(
        session_id=session_id,
        user_id=user.id,
        device_id=device_id,
        ip_address=login_request.ip_address,
        user_agent=login_request.user_agent,
        auth_method="password_totp" if login_request.totp_code else "password",
        mfa_verified=bool(login_request.totp_code),
        expires_at=session_expires_at,
        last_activity=datetime.utcnow(),
        risk_score=risk_score,
        anomalies_detected=anomalies,
        can_approve_role_changes=not requires_admin_approval,
    )
    db.add(admin_session)

    # Record successful login
    record_login_attempt(user, request, True, "success", device_id, db=db)

    db.commit()
    db.refresh(admin_session)

    # Generate token
    access_token = create_access_token({
        "sub": user.username,
        "role": user.role,
        "session_id": session_id,
    })

    trust_level = DeviceTrustPolicy.calculate_trust_level(
        device_age_days=(datetime.utcnow() - device.created_at).days,
        usage_frequency=len(user_history.get("known_devices", [])),
        risk_events=len(anomalies),
        mfa_verified_logins=1 if login_request.totp_code else 0,
    )
    device.trust_level = trust_level
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "session_id": session_id,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "display_name": user.display_name or user.username,
        },
        "risk_assessment": {
            "risk_score": risk_score,
            "risk_level": "critical" if risk_score >= 85 else "high" if risk_score >= 70 else "medium" if risk_score >= 50 else "low",
            "anomalies": anomalies,
            "requires_additional_mfa": requires_additional_mfa,
            "requires_admin_approval": requires_admin_approval,
        },
        "device": {
            "device_id": device_id,
            "trust_level": trust_level,
            "is_trusted": device.is_trusted,
        },
    }


@router.get("/risk-assessment/{session_id}")
async def get_risk_assessment(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RiskAssessmentResponse:
    """Get risk assessment for current session"""
    session = db.query(AdminSession).filter(
        AdminSession.session_id == session_id,
        AdminSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    risk_level = "critical" if session.risk_score >= 85 else "high" if session.risk_score >= 70 else "medium" if session.risk_score >= 50 else "low"
    
    recommendation = {
        "critical": "This login requires immediate admin verification and additional MFA",
        "high": "This login shows unusual patterns. Additional verification recommended.",
        "medium": "This login has some unusual characteristics. Use caution.",
        "low": "Login appears normal.",
    }.get(risk_level, "Unknown")

    return RiskAssessmentResponse(
        risk_score=session.risk_score,
        risk_level=risk_level,
        anomalies=session.anomalies_detected or {},
        requires_additional_mfa=session.risk_score >= 70,
        requires_admin_approval=session.risk_score >= 85,
        recommendation=recommendation,
        timestamp=session.created_at,
    )


@router.post("/verify-anomaly")
async def verify_anomaly_response(
    session_id: str,
    verification_code: str,  # Could be email OTP, hardware key, etc.
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify anomaly response (e.g., email OTP, biometric, etc.)
    This endpoint handles high-risk login verification
    """
    session = db.query(AdminSession).filter(
        AdminSession.session_id == session_id,
        AdminSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # TODO: Implement actual verification logic
    # For now, mark as verified after checking code
    if not verification_code or len(verification_code) < 4:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    session.mfa_verified = True
    session.risk_score = max(0, session.risk_score - 20)  # Reduce risk after verification
    db.commit()

    return VerifyAnomalyResponse(
        access_token=session.session_id,  # In real implementation, issue new token with higher permissions
        token_type="bearer",
        session_id=session.session_id,
        message="Anomaly verified successfully",
        verified=True,
    )
