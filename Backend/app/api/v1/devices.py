"""
Device Management and Zero-Trust Authentication Endpoints
Provides endpoints for managing trusted devices and device-based authentication
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user, require_admin
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
from app.services.email_service import send_email
import json
from sqlalchemy import desc

router = APIRouter(prefix="/api/v1/devices", tags=["devices"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class DeviceInfo(BaseModel):
    user_agent: str
    ip_address: str
    device_name: Optional[str] = None


class DeviceRegistrationRequest(BaseModel):
    device_name: str
    location: Optional[str] = None
    user_agent: str
    ip_address: str


class TrustedDeviceResponse(BaseModel):
    id: int
    device_name: str
    device_type: str
    browser: str
    os: str
    is_active: bool
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    location: Optional[str]
    can_access_sensitive_endpoints: bool
    allow_passwordless_login: bool

    class Config:
        from_attributes = True


class DeviceListResponse(BaseModel):
    total: int
    devices: List[TrustedDeviceResponse]


class SessionInfoResponse(BaseModel):
    session_id: str
    device_name: str
    created_at: datetime
    expires_at: datetime
    last_activity: datetime
    ip_address: str
    location: Optional[str]
    auth_method: str
    mfa_verified: bool

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    total: int
    active: int
    sessions: List[SessionInfoResponse]


class RevokeSessionRequest(BaseModel):
    session_id: str
    reason: Optional[str] = "User requested"


class DeviceTrustUpdateRequest(BaseModel):
    device_id: int
    can_access_sensitive_endpoints: Optional[bool] = None
    allow_passwordless_login: Optional[bool] = None
    expires_at: Optional[datetime] = None


class AnomalyResponse(BaseModel):
    risk_score: int
    anomalies: dict
    requires_additional_mfa: bool
    requires_admin_approval: bool
    recommendation: str


# ============================================================================
# Device Registration & Management Endpoints
# ============================================================================

@router.post("/register", response_model=dict)
async def register_device(
    request: Request,
    device_info: DeviceInfo,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register a new device for the current user.
    This is the first step in device trust setup.
    """
    user_agent = device_info.user_agent
    ip_address = device_info.ip_address

    # Generate device fingerprint
    device_id = DeviceFingerprintGenerator.generate_device_id(user_agent, ip_address)
    fingerprint_hash = DeviceFingerprintGenerator.create_fingerprint_hash(user_agent, ip_address)
    device_details = DeviceFingerprintGenerator.extract_device_info(user_agent)

    # Check if device already exists
    existing_device = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.device_id == device_id,
        DeviceFingerprint.user_id == current_user.id,
    ).first()

    if existing_device:
        # Update last used
        existing_device.last_used = datetime.utcnow()
        db.commit()
        return {
            "message": "Device already registered",
            "device_id": device_id,
            "is_new": False,
        }

    # Create new device fingerprint
    new_device = DeviceFingerprint(
        user_id=current_user.id,
        device_id=device_id,
        fingerprint_hash=fingerprint_hash,
        device_name=device_info.device_name or "Unknown Device",
        device_type=device_details.get("device_type", "laptop"),
        browser=device_details.get("browser", "Unknown"),
        browser_version=device_details.get("browser_version", ""),
        os=device_details.get("os", "Unknown"),
        os_version=device_details.get("os_version", ""),
        user_agent=user_agent,
        ip_address=ip_address,
        trust_level="untrusted",
        risk_score=40,  # New devices start with moderate risk
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)

    # Send notification email
    try:
        await send_email(
            to=current_user.email,
            subject="New Device Registered - Zero Trust Login",
            template="device_registered",
            template_data={
                "username": current_user.username,
                "device_name": device_info.device_name or "Unknown Device",
                "device_type": device_details.get("device_type", "laptop"),
                "browser": device_details.get("browser", "Unknown"),
                "os": device_details.get("os", "Unknown"),
                "ip_address": ip_address,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
    except Exception as e:
        print(f"Failed to send device registration email: {e}")

    return {
        "message": "Device registered successfully",
        "device_id": device_id,
        "is_new": True,
        "requires_approval": True,  # Admins should approve new devices
    }


@router.get("/my-devices", response_model=DeviceListResponse)
async def get_my_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all registered devices for the current user"""
    devices = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.user_id == current_user.id
    ).order_by(desc(DeviceFingerprint.last_used)).all()

    # Build response with trust info
    device_responses = []
    for device in devices:
        trusted = db.query(TrustedDevice).filter(
            TrustedDevice.device_fingerprint_id == device.id
        ).first()

        device_responses.append(
            TrustedDeviceResponse(
                id=device.id,
                device_name=device.device_name,
                device_type=device.device_type,
                browser=device.browser,
                os=device.os,
                is_active=trusted.is_active if trusted else False,
                last_used_at=device.last_used,
                expires_at=trusted.expires_at if trusted else None,
                location=trusted.location if trusted else None,
                can_access_sensitive_endpoints=trusted.can_access_sensitive_endpoints if trusted else False,
                allow_passwordless_login=trusted.allow_passwordless_login if trusted else False,
            )
        )

    return DeviceListResponse(total=len(device_responses), devices=device_responses)


@router.post("/trust/{device_id}")
async def trust_device(
    device_id: int,
    device_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a device as trusted by the user.
    Admin should still verify sensitive operations.
    """
    device_fingerprint = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.id == device_id,
        DeviceFingerprint.user_id == current_user.id,
    ).first()

    if not device_fingerprint:
        raise HTTPException(status_code=404, detail="Device not found")

    # Check if already trusted
    existing_trust = db.query(TrustedDevice).filter(
        TrustedDevice.device_fingerprint_id == device_id
    ).first()

    if existing_trust:
        return {"message": "Device already marked as trusted"}

    # Create trust record
    trust_record = TrustedDevice(
        user_id=current_user.id,
        device_fingerprint_id=device_id,
        device_name=device_name,
        is_active=True,
        trusted_reason="User self-verified",
    )
    db.add(trust_record)

    # Update device trust level
    device_fingerprint.is_trusted = True
    device_fingerprint.trust_level = "medium"
    device_fingerprint.risk_score = 20

    db.commit()

    return {
        "message": "Device marked as trusted",
        "device_id": device_id,
        "device_name": device_name,
    }


@router.delete("/untrust/{device_id}")
async def untrust_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove trust from a device"""
    trust_record = db.query(TrustedDevice).filter(
        TrustedDevice.device_fingerprint_id == device_id
    ).first()

    if not trust_record or trust_record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trust record not found")

    device_fingerprint = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.id == device_id
    ).first()

    if device_fingerprint:
        device_fingerprint.is_trusted = False
        device_fingerprint.trust_level = "untrusted"
        device_fingerprint.risk_score = 50

    db.delete(trust_record)
    db.commit()

    return {"message": "Device untrusted"}


@router.delete("/revoke/{device_id}")
async def revoke_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revoke/block a device.
    This prevents further logins from this device.
    """
    device = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.id == device_id,
        DeviceFingerprint.user_id == current_user.id,
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.blocked = True
    device.block_reason = "User revoked access"
    device.risk_score = 100

    # Revoke all active sessions from this device
    active_sessions = db.query(AdminSession).filter(
        AdminSession.device_id == device.device_id,
        AdminSession.revoked_at.is_(None),
    ).all()

    for session in active_sessions:
        session.revoked_at = datetime.utcnow()
        session.revoke_reason = "Device revoked by user"

    db.commit()

    return {"message": "Device revoked"}


# ============================================================================
# Session Management Endpoints
# ============================================================================

@router.get("/sessions", response_model=SessionListResponse)
async def get_my_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all active sessions for the current user"""
    now = datetime.utcnow()

    all_sessions = db.query(AdminSession).filter(
        AdminSession.user_id == current_user.id
    ).order_by(desc(AdminSession.created_at)).all()

    active_sessions = [
        s for s in all_sessions
        if s.revoked_at is None and s.expires_at > now
    ]

    session_responses = []
    for session in active_sessions:
        device = db.query(DeviceFingerprint).filter(
            DeviceFingerprint.device_id == session.device_id
        ).first()

        trusted = db.query(TrustedDevice).filter(
            TrustedDevice.device_fingerprint_id == device.id
        ).first() if device else None

        session_responses.append(
            SessionInfoResponse(
                session_id=session.session_id,
                device_name=trusted.device_name if trusted else device.device_name if device else "Unknown",
                created_at=session.created_at,
                expires_at=session.expires_at,
                last_activity=session.last_activity,
                ip_address=session.ip_address,
                location=session.location,
                auth_method=session.auth_method,
                mfa_verified=session.mfa_verified,
            )
        )

    return SessionListResponse(
        total=len(all_sessions),
        active=len(active_sessions),
        sessions=session_responses,
    )


@router.post("/sessions/revoke")
async def revoke_session(
    revoke_request: RevokeSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a specific session"""
    session = db.query(AdminSession).filter(
        AdminSession.session_id == revoke_request.session_id,
        AdminSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.revoked_at = datetime.utcnow()
    session.revoke_reason = revoke_request.reason
    db.commit()

    return {"message": "Session revoked"}


@router.post("/sessions/revoke-all")
async def revoke_all_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revoke all sessions except current one.
    This is useful if user suspects compromise.
    """
    now = datetime.utcnow()
    current_session_id = None  # Would come from request header in real implementation

    sessions_to_revoke = db.query(AdminSession).filter(
        AdminSession.user_id == current_user.id,
        AdminSession.revoked_at.is_(None),
        AdminSession.expires_at > now,
    ).all()

    revoked_count = 0
    for session in sessions_to_revoke:
        if session.session_id != current_session_id:
            session.revoked_at = datetime.utcnow()
            session.revoke_reason = "User revoked all sessions"
            revoked_count += 1

    db.commit()

    return {
        "message": f"Revoked {revoked_count} sessions",
        "revoked_count": revoked_count,
    }


# ============================================================================
# Admin Device Management (Admin only)
# ============================================================================

@router.get("/admin/devices", dependencies=[Depends(require_admin)])
async def admin_list_all_devices(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: List all devices across all users"""
    devices = db.query(DeviceFingerprint).offset(skip).limit(limit).all()
    total = db.query(DeviceFingerprint).count()

    device_list = []
    for device in devices:
        user = db.query(User).filter(User.id == device.user_id).first()
        device_list.append({
            "id": device.id,
            "device_id": device.device_id,
            "username": user.username if user else "Unknown",
            "device_name": device.device_name,
            "device_type": device.device_type,
            "browser": device.browser,
            "os": device.os,
            "is_trusted": device.is_trusted,
            "trust_level": device.trust_level,
            "risk_score": device.risk_score,
            "blocked": device.blocked,
            "last_used": device.last_used,
            "created_at": device.created_at,
        })

    return {
        "total": total,
        "devices": device_list,
    }


@router.patch("/admin/devices/{device_id}/trust", dependencies=[Depends(require_admin)])
async def admin_update_device_trust(
    device_id: int,
    update: DeviceTrustUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: Update device trust settings"""
    device = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.id == device_id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    trusted_device = db.query(TrustedDevice).filter(
        TrustedDevice.device_fingerprint_id == device_id
    ).first()

    if not trusted_device:
        raise HTTPException(status_code=404, detail="Trusted device record not found")

    if update.can_access_sensitive_endpoints is not None:
        trusted_device.can_access_sensitive_endpoints = update.can_access_sensitive_endpoints

    if update.allow_passwordless_login is not None:
        trusted_device.allow_passwordless_login = update.allow_passwordless_login

    if update.expires_at is not None:
        trusted_device.expires_at = update.expires_at

    db.commit()

    return {"message": "Device trust updated"}


@router.post("/admin/devices/{device_id}/block", dependencies=[Depends(require_admin)])
async def admin_block_device(
    device_id: int,
    reason: str = "Admin action",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: Block a device"""
    device = db.query(DeviceFingerprint).filter(
        DeviceFingerprint.id == device_id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.blocked = True
    device.block_reason = reason
    device.risk_score = 100
    device.blocked_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Device blocked",
        "device_id": device_id,
        "reason": reason,
    }
