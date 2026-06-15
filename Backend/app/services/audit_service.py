from datetime import datetime, timezone
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def log_role_change(
    db: Session,
    action: str,
    target_user: User,
    performer: User,
    old_role: str,
    new_role: str,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Log a role change event to the audit log."""
    log_entry = AuditLog(
        action=action,
        target_user_id=target_user.id,
        target_username=target_user.username,
        performed_by_id=performer.id,
        performed_by_username=performer.username,
        old_value=old_role,
        new_value=new_role,
        details=details or {},
        ip_address=ip_address,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def get_audit_logs(
    db: Session,
    limit: int = 100,
    offset: int = 0,
    target_user_id: Optional[int] = None,
    action: Optional[str] = None,
    performed_by_id: Optional[int] = None,
) -> list[AuditLog]:
    """Retrieve audit logs with optional filters."""
    query = db.query(AuditLog)
    if target_user_id:
        query = query.filter(AuditLog.target_user_id == target_user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if performed_by_id:
        query = query.filter(AuditLog.performed_by_id == performed_by_id)
    return (
        query.order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
