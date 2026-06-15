from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False, index=True)  # e.g., "role_change_approved", "role_change_rejected", "user_role_updated"
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    target_username = Column(String, nullable=True)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    performed_by_username = Column(String, nullable=False)
    old_value = Column(String, nullable=True)  # e.g., old role
    new_value = Column(String, nullable=True)  # e.g., new role
    details = Column(JSON, nullable=True)  # extra info like notes, request_id
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    target_user = relationship("User", foreign_keys=[target_user_id], backref="target_audit_logs")
    performer = relationship("User", foreign_keys=[performed_by_id], backref="performed_audit_logs")
