"""Administrator endpoints for user management.

Only accessible to users with role == "admin".
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.auth import get_current_user, require_admin, require_role, ADMIN
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.role_request_service import (
    create_role_request,
    get_pending_requests,
    approve_request,
    reject_request,
    get_user_pending_request,
)

router = APIRouter()


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = "user"
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None


class RoleRequestCreate(BaseModel):
    desired_role: str


class RoleRequestAction(BaseModel):
    notes: Optional[str] = None


# All admin routes now use the centralized RBAC dependency
# (real role is always loaded from DB inside get_current_user)


@router.get("/users", response_model=List[dict])
def list_all_users(
    current_user: User = require_admin(),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "display_name": u.display_name,
            "bio": u.bio,
            "avatar_url": u.avatar_url,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        })
    return result


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user_as_admin(
    data: AdminUserCreate,
    current_user: User = require_admin(),
    db: Session = Depends(get_db),
):

    # Basic duplicate check
    existing = db.query(User).filter(
        (User.username == data.username) | (User.email == data.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    hashed = hash_password(data.password)
    new_user = User(
        username=data.username,
        email=data.email,
        hashed_password=hashed,
        role=data.role.lower(),
        is_active=data.is_active,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}", response_model=dict)
def update_user_as_admin(
    user_id: int,
    updates: AdminUserUpdate,
    current_user: User = require_admin(),
    db: Session = Depends(get_db),
):

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-demotion of last admin (simple safeguard)
    if user.id == current_user.id and updates.role is not None and updates.role.lower() != "admin":
        other_admins = db.query(User).filter(User.role == "admin", User.id != user.id).count()
        if other_admins == 0:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    if updates.role is not None:
        user.role = updates.role.lower()
    if updates.is_active is not None:
        user.is_active = updates.is_active
    if updates.display_name is not None:
        user.display_name = updates.display_name or None
    if updates.bio is not None:
        user.bio = updates.bio or None

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "display_name": user.display_name,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.delete("/users/{user_id}")
def delete_user_as_admin(
    user_id: int,
    current_user: User = require_admin(),
    db: Session = Depends(get_db),
):

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Safeguard: don't delete last admin
    if user.role == "admin":
        other_admins = db.query(User).filter(User.role == "admin", User.id != user.id).count()
        if other_admins == 0:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")

    db.delete(user)
    db.commit()
    return {"status": "deleted", "user_id": user_id}


# =============================================================================
# Role Change Requests (for testing switcher - not permanent until approved)
# =============================================================================

@router.post("/me/request-role")
def request_role_change(
    data: RoleRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User requests a role change (used by testing Role Switcher).
    This is NOT permanent. An administrator must approve it.
    """
    allowed_roles = {"user", "supervisor", "hr", "lead", "admin"}
    desired = data.desired_role.lower()
    if desired not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role requested")

    if desired == current_user.role:
        raise HTTPException(status_code=400, detail="You already have this role")

    req = create_role_request(db, current_user.id, desired)
    return {
        "status": "request_submitted",
        "request_id": req.id,
        "requested_role": desired,
        "message": "Your role change request has been submitted for administrator approval."
    }


@router.get("/role-requests")
def list_role_requests(
    current_user: User = require_admin(),
    db: Session = Depends(get_db),
):
    requests = get_pending_requests(db)
    result = []
    for r in requests:
        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "username": r.user.username,
            "email": r.user.email,
            "current_role": r.user.role,
            "requested_role": r.requested_role,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "status": r.status,
        })
    return {"requests": result}


@router.post("/role-requests/{request_id}/approve")
def approve_role_request(
    request_id: int,
    action: RoleRequestAction = None,
    current_user: User = require_admin(),
    db: Session = Depends(get_db),
):
    req = approve_request(db, request_id, current_user.id, action.notes if action else None)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    return {
        "status": "approved",
        "user_id": req.user_id,
        "new_role": req.requested_role,
    }


@router.post("/role-requests/{request_id}/reject")
def reject_role_request(
    request_id: int,
    action: RoleRequestAction = None,
    current_user: User = require_admin(),
    db: Session = Depends(get_db),
):
    req = reject_request(db, request_id, current_user.id, action.notes if action else None)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    return {"status": "rejected"}