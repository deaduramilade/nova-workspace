"""
Async tasks for memory ingestion using Celery.

Triggered when meetings end, transcripts are generated, or manual ingestion is requested.
"""

import asyncio
from typing import Optional, Dict, Any
from app.core.config import settings

# Optional Celery setup (if celery is configured)
try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    def shared_task(func):
        """Stub for when Celery is not available."""
        return func


@shared_task(name="ingest_meeting_transcript")
def ingest_meeting_transcript_task(
    workspace_id: int,
    transcript: str,
    meeting_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Async Celery task to ingest a meeting transcript.
    
    Triggered when:
    - Meeting recording ends and transcript is ready
    - Manual ingestion is requested via API
    
    Args:
        workspace_id: ID of the workspace
        transcript: Meeting transcript text
        meeting_id: Optional meeting ID reference
        metadata: Optional metadata (role_tags, attendees, etc.)
    
    Returns:
        Dict with status and created chunk count
    """
    if not settings.MEMORY_INGESTION_ENABLED:
        return {"status": "skipped", "reason": "memory_ingestion_disabled"}
    
    try:
        from sqlalchemy.orm import Session
        from app.core.database import SessionLocal
        from app.services.memory_ingestion import ingest_meeting_transcript
        
        db = SessionLocal()
        try:
            # Run async ingestion
            chunks = asyncio.run(ingest_meeting_transcript(
                db=db,
                workspace_id=workspace_id,
                transcript=transcript,
                meeting_id=meeting_id,
                metadata=metadata,
            ))
            
            return {
                "status": "success",
                "chunks_created": len(chunks),
                "chunk_ids": [c.id for c in chunks],
            }
        finally:
            db.close()
    
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }
