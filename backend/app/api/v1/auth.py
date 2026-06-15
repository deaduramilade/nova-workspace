from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import enforce_rate_limit
from app.core.security import hash_password, create_access_token, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse

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
def login(username: str, password: str, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, bucket="auth_login", limit=settings.RATE_LIMIT_AUTH_PER_MINUTE)

    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    access_token = create_access_token({"sub": user.username, "role": user.role})

    # Return richer user shape so frontend can immediately show avatar / display name
    user_payload = {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "display_name": user.display_name or user.username,
        "avatar_url": user.avatar_url,
    }

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_payload,
    }