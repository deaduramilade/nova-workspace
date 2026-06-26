from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

try:
    from pgvector.sqlalchemy import Vector
except ImportError:  # pragma: no cover - optional dependency in local dev
    Vector = None


class ChunkType(str, Enum):
    """Enumeration for types of memory chunks."""
    DECISION = "decision"
    ACTION_ITEM = "action_item"
    DISCUSSION = "discussion"
    SUMMARY = "summary"


class MemoryChunk(Base):
    """
    Stores AI-generated memory chunks from meetings and collaboration sessions.
    Each chunk can be embedded and semantically searched.
    """
    __tablename__ = "memory_chunks"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True)
    meeting_id = Column(Integer, nullable=True, index=True)  # Reference to meeting/session
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536) if Vector else JSON, nullable=True)  # Falls back to JSON when pgvector is unavailable
    chunk_type = Column(SQLEnum(ChunkType), nullable=False, default=ChunkType.DISCUSSION)
    chunk_metadata = Column("metadata", JSON, nullable=True, default={})  # role tags, user_id, timestamp, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship back to workspace
    workspace = relationship("Workspace", backref="memory_chunks")

    # Relationship to action items created from this chunk
    action_items = relationship("ActionItem", back_populates="memory_chunk", cascade="all, delete-orphan")
