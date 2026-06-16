from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class ActionItemStatus(str, Enum):
    """Enumeration for action item status."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class ActionItem(Base):
    """
    Action items extracted from memory chunks and assigned to team members.
    Tracks progress, due dates, and assignment history.
    """
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    memory_chunk_id = Column(Integer, ForeignKey("memory_chunks.id"), nullable=False, index=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(SQLEnum(ActionItemStatus), nullable=False, default=ActionItemStatus.OPEN)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    memory_chunk = relationship("MemoryChunk", back_populates="action_items")
    assigned_to_user = relationship("User", backref="assigned_action_items")
