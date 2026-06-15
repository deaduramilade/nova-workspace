from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class RoleRequest(Base):
    __tablename__ = "role_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    requested_role = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, approved, rejected
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(String, nullable=True)

    user = relationship("User", foreign_keys=[user_id], backref="role_requests")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])