"""Pydantic schemas for Memory model."""

from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.models.memory import MemoryType


class MemoryCreate(BaseModel):
    """Schema for creating a new memory."""
    
    workspace_id: int = Field(..., description="Workspace ID")
    user_id: Optional[int] = Field(None, description="User ID (optional, for personal memory)")
    memory_type: MemoryType = Field(default=MemoryType.NOTE, description="Type of memory")
    content: str = Field(..., min_length=1, description="Memory content")
    source_meeting_id: Optional[int] = Field(None, description="Source meeting ID if applicable")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        from_attributes = True


class MemoryUpdate(BaseModel):
    """Schema for updating a memory."""
    
    memory_type: Optional[MemoryType] = Field(None, description="Type of memory")
    content: Optional[str] = Field(None, min_length=1, description="Memory content")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    
    class Config:
        from_attributes = True


class MemoryResponse(BaseModel):
    """Schema for returning memory data."""
    
    id: int
    workspace_id: int
    user_id: Optional[int] = None
    memory_type: str
    content: str
    embedding: Optional[Dict[str, Any]] = None
    source_meeting_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class MemorySearchRequest(BaseModel):
    """Schema for searching memories."""
    
    workspace_id: int = Field(..., description="Workspace ID")
    query: str = Field(..., min_length=1, description="Search query or semantic query")
    memory_type: Optional[MemoryType] = Field(None, description="Filter by memory type")
    limit: int = Field(default=10, ge=1, le=100, description="Number of results")
    offset: int = Field(default=0, ge=0, description="Pagination offset")
    
    class Config:
        from_attributes = True


class MemorySearchResponse(BaseModel):
    """Schema for search results."""
    
    total: int = Field(..., description="Total results matching the query")
    results: List[MemoryResponse] = Field(..., description="Matched memories")
    query: str = Field(..., description="Original query")
    
    class Config:
        from_attributes = True
