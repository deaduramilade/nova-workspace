from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.role_request import RoleRequest
from app.models.user import User

def create_role_request(db: Session, user_id: int, requested_role: str) -> RoleRequest:
    # Check if there's already a pending request for this user
    existing = db.query(RoleRequest).filter(
        RoleRequest.user_id == user_id,
        RoleRequest.status == "pending"
    ).first()
    if existing:
        # Update the requested role if different
        existing.requested_role = requested_role
        existing.requested_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    req = RoleRequest(
        user_id=user_id,
        requested_role=requested_role,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

def get_pending_requests(db: Session) -> List[RoleRequest]:
    return db.query(RoleRequest).filter(
        RoleRequest.status == "pending"
    ).order_by(RoleRequest.requested_at.desc()).all()

def approve_request(db: Session, request_id: int, admin_user_id: int, notes: Optional[str] = None) -> Optional[RoleRequest]:
    req = db.query(RoleRequest).filter(RoleRequest.id == request_id).first()
    if not req or req.status != "pending":
        return None

    # Update the user's role permanently
    user = db.query(User).filter(User.id == req.user_id).first()
    if user:
        user.role = req.requested_role

    req.status = "approved"
    req.reviewed_at = datetime.now(timezone.utc)
    req.reviewed_by_id = admin_user_id
    req.notes = notes

    db.commit()
    db.refresh(req)
    return req

def reject_request(db: Session, request_id: int, admin_user_id: int, notes: Optional[str] = None) -> Optional[RoleRequest]:
    req = db.query(RoleRequest).filter(RoleRequest.id == request_id).first()
    if not req or req.status != "pending":
        return None

    req.status = "rejected"
    req.reviewed_at = datetime.now(timezone.utc)
    req.reviewed_by_id = admin_user_id
    req.notes = notes

    db.commit()
    db.refresh(req)
    return req

def get_user_pending_request(db: Session, user_id: int) -> Optional[RoleRequest]:
    return db.query(RoleRequest).filter(
        RoleRequest.user_id == user_id,
        RoleRequest.status == "pending"
    ).first()