"""Memory model for Nova Workspace - stores meeting notes, decisions, and action items."""

from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class MemoryType(str, Enum):
    """Types of memories that can be stored."""
    MEETING = "meeting"
    DECISION = "decision"
    ACTION_ITEM = "action_item"
    NOTE = "note"


class Memory(Base):
    """Stores memories (notes, decisions, action items) from meetings and workspaces."""
    
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    
    # Workspace & User relationships
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # NULL = workspace-level memory
    
    # Memory type and content
    memory_type = Column(String, default=MemoryType.NOTE, nullable=False, index=True)
    content = Column(Text, nullable=False)
    
    # Embedding for semantic search (JSON for now, will migrate to pgvector)
    embedding = Column(JSON, nullable=True)
    
    # Source information
    source_meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Additional metadata
    metadata = Column(JSON, nullable=True, default={})
    
    # Relationships
    workspace = relationship("Workspace", backref="memories")
    user = relationship("User", backref="memories")
    # source_meeting relationship will be added once Meeting model is created
