from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.role_request import RoleChangeRequest
from app.models.user import User

def create_role_request(db: Session, user_id: int, requested_role: str) -> RoleChangeRequest:
    # Check if there's already a pending request for this user
    existing = db.query(RoleChangeRequest).filter(
        RoleChangeRequest.user_id == user_id,
        RoleChangeRequest.status == "pending"
    ).first()
    if existing:
        # Update the requested role if different
        existing.requested_role = requested_role
        existing.requested_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    req = RoleChangeRequest(
        user_id=user_id,
        requested_role=requested_role,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

def get_pending_requests(db: Session) -> List[RoleChangeRequest]:
    return db.query(RoleChangeRequest).filter(
        RoleChangeRequest.status == "pending"
    ).order_by(RoleChangeRequest.requested_at.desc()).all()

def approve_request(db: Session, request_id: int, admin_user_id: int, notes: Optional[str] = None) -> Optional[RoleChangeRequest]:
    req = db.query(RoleChangeRequest).filter(RoleChangeRequest.id == request_id).first()
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

def reject_request(db: Session, request_id: int, admin_user_id: int, notes: Optional[str] = None) -> Optional[RoleChangeRequest]:
    req = db.query(RoleChangeRequest).filter(RoleChangeRequest.id == request_id).first()
    if not req or req.status != "pending":
        return None

    req.status = "rejected"
    req.reviewed_at = datetime.now(timezone.utc)
    req.reviewed_by_id = admin_user_id
    req.notes = notes

    db.commit()
    db.refresh(req)
    return req

def get_user_pending_request(db: Session, user_id: int) -> Optional[RoleChangeRequest]:
    return db.query(RoleChangeRequest).filter(
        RoleChangeRequest.user_id == user_id,
        RoleChangeRequest.status == "pending"
    ).first()