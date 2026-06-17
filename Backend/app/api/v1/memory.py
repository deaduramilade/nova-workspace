"""
Memory & Meeting Intelligence API endpoints.

Endpoints for ingesting meeting transcripts, retrieving memory chunks, and managing action items.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.memory_chunk import MemoryChunk, ChunkType
from app.models.action_item import ActionItem, ActionItemStatus
from app.services.memory_ingestion import (
    ingest_meeting_transcript,
    retrieve_memory_chunks_by_role,
    MemoryIngestionError,
)

router = APIRouter(prefix="/api/v1/memory", tags=["memory"])


class TranscriptIngestionRequest:
    """Request schema for transcript ingestion."""
    workspace_id: int
    transcript: str
    meeting_id: Optional[int] = None
    role_tags: List[str] = ["general"]


class MemoryChunkResponse:
    """Response schema for memory chunks."""
    id: int
    workspace_id: int
    meeting_id: Optional[int]
    content: str
    chunk_type: str
    metadata: dict
    created_at: str


@router.post("/ingest-transcript")
async def ingest_transcript(
    workspace_id: int = Body(...),
    transcript: str = Body(...),
    meeting_id: Optional[int] = Body(None),
    role_tags: List[str] = Body(["general"]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ingest a meeting transcript to extract and store memory chunks.
    
    This endpoint triggers:
    - Extraction of decisions, action items, and discussion points
    - Storage as MemoryChunk records with embeddings
    - Creation of ActionItem records for assigned tasks
    
    Requires: Supervisor or Administrator role
    """
    if current_user.role not in ["supervisor", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        metadata = {
            "role_tags": role_tags,
            "ingested_by": current_user.username,
        }
        
        chunks = await ingest_meeting_transcript(
            db=db,
            workspace_id=workspace_id,
            transcript=transcript,
            meeting_id=meeting_id,
            metadata=metadata,
        )
        
        return {
            "status": "success",
            "chunks_created": len(chunks),
            "chunks": [
                {
                    "id": c.id,
                    "type": c.chunk_type.value,
                    "preview": c.content[:100],
                }
                for c in chunks
            ],
        }
    
    except MemoryIngestionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/chunks")
async def list_memory_chunks(
    workspace_id: int,
    chunk_type: Optional[str] = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List memory chunks for the user's role.
    
    Filters by role_tags in metadata to ensure role-appropriate access.
    """
    role_tags = [current_user.role, "general"]
    
    chunk_type_enum = None
    if chunk_type:
        try:
            chunk_type_enum = ChunkType(chunk_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid chunk_type. Must be one of: {', '.join([ct.value for ct in ChunkType])}",
            )
    
    chunks = retrieve_memory_chunks_by_role(
        db=db,
        workspace_id=workspace_id,
        role_tags=role_tags,
        chunk_type=chunk_type_enum,
        limit=limit,
    )
    
    return {
        "status": "success",
        "count": len(chunks),
        "chunks": [
            {
                "id": c.id,
                "type": c.chunk_type.value,
                "content": c.content,
                "metadata": c.metadata,
                "created_at": c.created_at.isoformat(),
            }
            for c in chunks
        ],
    }


@router.get("/action-items")
async def list_action_items(
    workspace_id: int,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List action items assigned to or visible by the current user.
    
    - Supervisors/Admins: see all
    - Workers: see only their own
    """
    query = db.query(ActionItem).join(ActionItem.memory_chunk).filter(
        MemoryChunk.workspace_id == workspace_id
    )
    
    # Filter by role
    if current_user.role not in ["supervisor", "administrator"]:
        query = query.filter(ActionItem.assigned_to_user_id == current_user.id)
    
    if status:
        try:
            status_enum = ActionItemStatus(status)
            query = query.filter(ActionItem.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join([s.value for s in ActionItemStatus])}",
            )
    
    items = query.order_by(ActionItem.due_date).all()
    
    return {
        "status": "success",
        "count": len(items),
        "action_items": [
            {
                "id": i.id,
                "description": i.description,
                "assigned_to": i.assigned_to_user.username if i.assigned_to_user else None,
                "status": i.status.value,
                "due_date": i.due_date.isoformat() if i.due_date else None,
                "created_at": i.created_at.isoformat(),
            }
            for i in items
        ],
    }


@router.patch("/action-items/{item_id}")
async def update_action_item(
    item_id: int,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update action item status.
    
    Only the assigned user or supervisors/admins can update.
    """
    item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    # Check permissions
    if current_user.id != item.assigned_to_user_id and current_user.role not in ["supervisor", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    if status:
        try:
            item.status = ActionItemStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join([s.value for s in ActionItemStatus])}",
            )
    
    db.commit()
    db.refresh(item)
    
    return {
        "status": "success",
        "action_item": {
            "id": item.id,
            "description": item.description,
            "assigned_to": item.assigned_to_user.username if item.assigned_to_user else None,
            "status": item.status.value,
            "due_date": item.due_date.isoformat() if item.due_date else None,
        },
    }
