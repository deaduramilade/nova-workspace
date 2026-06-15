from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
import pyotp
import qrcode
import io
import base64

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import enforce_rate_limit
from app.core.security import hash_password, create_access_token, verify_password
from app.models.user import User
from app.schemas.user import (
    UserCreate, UserResponse, TOTPSetupResponse, TOTPVerifyRequest, LoginMFARequest
)

router = APIRouter()

_RESERVED_ROLES = {"admin", "supervisor", "lead", "hr"}


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    # Stricter per-endpoint bucket on top of middleware auth tier
    enforce_rate_limit(request, bucket="auth_register", limit=max(5, settings.RATE_LIMIT_AUTH_PER_MINUTE // 2))

    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is disabled on this instance",
        )

    if user_data.role in _RESERVED_ROLES and not settings.is_development:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Privileged roles cannot be self-assigned",
        )

    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")

    hashed_pw = hash_password(user_data.password)

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pw,
        role=user_data.role,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login")
def login(
    username: str, 
    password: str, 
    totp_code: str = None,
    request: Request = None, 
    db: Session = Depends(get_db)
):
    enforce_rate_limit(request, bucket="auth_login", limit=settings.RATE_LIMIT_AUTH_PER_MINUTE)

    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    if user.totp_enabled:
        if not totp_code:
            return {
                "mfa_required": True,
                "message": "TOTP code required",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role,
                    "mfa_enabled": True,
                    "totp_enabled": True,
                }
            }
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(totp_code):
            raise HTTPException(401, "Invalid TOTP code")

    access_token = create_access_token({"sub": user.username, "role": user.role})

    user_payload = {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "display_name": user.display_name or user.username,
        "avatar_url": user.avatar_url,
        "mfa_enabled": user.mfa_enabled,
        "totp_enabled": user.totp_enabled,
    }

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_payload,
    }


@router.post("/mfa/totp/setup", response_model=TOTPSetupResponse)
def setup_totp(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.totp_enabled:
        raise HTTPException(400, "TOTP already enabled")

    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=current_user.email or current_user.username, issuer_name=settings.PROJECT_NAME)

    # Generate QR code as data URL
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_code_url = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

    return TOTPSetupResponse(
        secret=secret,
        qr_code_url=qr_code_url,
        provisioning_uri=provisioning_uri,
    )


@router.post("/mfa/totp/verify")
def verify_totp(
    data: TOTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.totp_secret:
        raise HTTPException(400, "No TOTP secret set up")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code):
        raise HTTPException(401, "Invalid TOTP code")

    current_user.totp_enabled = True
    current_user.mfa_enabled = True
    db.add(current_user)
    db.commit()

    return {"status": "enabled", "message": "TOTP MFA enabled successfully"}


@router.post("/mfa/totp/disable")
def disable_totp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.totp_secret = None
    current_user.totp_enabled = False
    current_user.mfa_enabled = False
    db.add(current_user)
    db.commit()
    return {"status": "disabled"}