"""
Memory Ingestion Service

Processes meeting transcripts to extract and store memory chunks.
Uses local Ollama LLM to extract decisions, action items, and discussion points.
Stores results with semantic embeddings and role-based metadata.
"""

import json
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import ollama

from app.core.config import settings
from app.models.memory_chunk import MemoryChunk, ChunkType
from app.models.action_item import ActionItem, ActionItemStatus
from app.models.user import User
from app.models.workspace import Workspace


class MemoryIngestionError(Exception):
    """Raised when memory ingestion fails."""
    pass


async def ingest_meeting_transcript(
    db: Session,
    workspace_id: int,
    transcript: str,
    meeting_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> List[MemoryChunk]:
    """
    Ingest a meeting transcript and extract memory chunks.
    
    Args:
        db: Database session
        workspace_id: ID of the workspace
        transcript: Full meeting transcript text
        meeting_id: Optional reference to meeting ID
        metadata: Optional metadata dict (e.g., meeting_date, attendees, role_tags)
    
    Returns:
        List of created MemoryChunk objects
    
    Raises:
        MemoryIngestionError: If ingestion fails
    """
    if not settings.OLLAMA_ENABLED or not settings.MEMORY_INGESTION_ENABLED:
        return []
    
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise MemoryIngestionError(f"Workspace {workspace_id} not found")
    
    try:
        # Extract key elements from transcript using Ollama
        extraction_results = await _extract_elements_from_transcript(transcript)
        
        if not extraction_results:
            return []
        
        # Prepare metadata with role tags
        chunk_metadata = metadata or {}
        if "role_tags" not in chunk_metadata:
            chunk_metadata["role_tags"] = []
        chunk_metadata["extracted_at"] = datetime.now(timezone.utc).isoformat()
        
        created_chunks = []
        
        # Store decisions
        for decision in extraction_results.get("decisions", []):
            chunk = await _store_memory_chunk(
                db=db,
                workspace_id=workspace_id,
                meeting_id=meeting_id,
                content=decision,
                chunk_type=ChunkType.DECISION,
                metadata=chunk_metadata,
            )
            if chunk:
                created_chunks.append(chunk)
        
        # Store discussion points
        for discussion in extraction_results.get("discussions", []):
            chunk = await _store_memory_chunk(
                db=db,
                workspace_id=workspace_id,
                meeting_id=meeting_id,
                content=discussion,
                chunk_type=ChunkType.DISCUSSION,
                metadata=chunk_metadata,
            )
            if chunk:
                created_chunks.append(chunk)
        
        # Store action items and create ActionItem records
        for action_item_data in extraction_results.get("action_items", []):
            chunk = await _store_memory_chunk(
                db=db,
                workspace_id=workspace_id,
                meeting_id=meeting_id,
                content=action_item_data.get("description", ""),
                chunk_type=ChunkType.ACTION_ITEM,
                metadata={
                    **chunk_metadata,
                    "assigned_to": action_item_data.get("assigned_to"),
                    "due_date": action_item_data.get("due_date"),
                },
            )
            if chunk:
                # Try to create associated ActionItem if assignee found
                assignee_name = action_item_data.get("assigned_to")
                if assignee_name:
                    assigned_user = db.query(User).filter(
                        User.username.ilike(assignee_name)
                    ).first()
                    if assigned_user:
                        action_item = ActionItem(
                            memory_chunk_id=chunk.id,
                            assigned_to_user_id=assigned_user.id,
                            description=action_item_data.get("description", ""),
                            status=ActionItemStatus.OPEN,
                        )
                        db.add(action_item)
                
                created_chunks.append(chunk)
        
        db.commit()
        return created_chunks
    
    except Exception as e:
        db.rollback()
        raise MemoryIngestionError(f"Failed to ingest transcript: {str(e)}") from e


async def _extract_elements_from_transcript(transcript: str) -> Optional[Dict[str, Any]]:
    """
    Use Ollama to extract decisions, action items, and discussion points from transcript.
    
    Args:
        transcript: Meeting transcript
    
    Returns:
        Dict with keys: decisions, action_items, discussions
    """
    if not settings.OLLAMA_ENABLED:
        return None
    
    prompt = f"""Analyze the following meeting transcript and extract:
1. Key decisions made (list as bullet points)
2. Action items with assigned persons if mentioned (format: "Action: [description] | Assigned to: [name]")
3. Important discussion points (list 3-5 key points)

TRANSCRIPT:
{transcript}

Respond in JSON format with these keys: decisions (list), action_items (list of objects with 'description' and 'assigned_to' fields), discussions (list).
Only return valid JSON, no additional text."""

    try:
        client = ollama.Client(host=settings.OLLAMA_URL)
        response = client.generate(
            model=settings.OLLAMA_MODEL,
            prompt=prompt,
            stream=False,
        )
        
        response_text = response.get("response", "")
        
        # Try to parse JSON from response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            return result
        else:
            # Fallback parsing if JSON not properly formatted
            return _parse_extraction_fallback(response_text)
    
    except Exception as e:
        print(f"[WARN] Ollama extraction failed: {e}")
        return None


def _parse_extraction_fallback(response_text: str) -> Dict[str, Any]:
    """
    Fallback parser if JSON extraction fails.
    Attempts to parse plain-text response into structured format.
    """
    decisions = []
    action_items = []
    discussions = []
    
    sections = response_text.split("\n\n")
    for section in sections:
        lines = section.split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("- ") or line.startswith("* "):
                line = line[2:].strip()
            
            if "decision" in line.lower():
                decisions.append(line)
            elif "action" in line.lower() or "todo" in line.lower():
                action_items.append({"description": line, "assigned_to": None})
            else:
                discussions.append(line)
    
    return {
        "decisions": decisions[:5],
        "action_items": action_items[:10],
        "discussions": discussions[:5],
    }


async def _store_memory_chunk(
    db: Session,
    workspace_id: int,
    content: str,
    chunk_type: ChunkType,
    meeting_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[MemoryChunk]:
    """
    Store a single memory chunk with optional embedding.
    
    Args:
        db: Database session
        workspace_id: Workspace ID
        content: Chunk content
        chunk_type: Type of chunk (decision, action_item, etc.)
        meeting_id: Optional meeting reference
        metadata: Additional metadata
    
    Returns:
        Created MemoryChunk or None if failed
    """
    try:
        chunk_metadata = metadata or {}
        
        # Optional: Generate embedding from Ollama
        embedding = None
        if settings.OLLAMA_ENABLED:
            try:
                embedding = await _generate_embedding(content)
            except Exception as e:
                print(f"[WARN] Embedding generation failed: {e}")
        
        chunk = MemoryChunk(
            workspace_id=workspace_id,
            meeting_id=meeting_id,
            content=content,
            embedding=embedding,
            chunk_type=chunk_type,
            metadata=chunk_metadata,
        )
        db.add(chunk)
        db.flush()  # Get the ID without committing
        return chunk
    
    except Exception as e:
        print(f"[ERROR] Failed to store memory chunk: {e}")
        return None


async def _generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate embedding for text using Ollama embeddings endpoint.
    Uses nomic-embed-text model (768 dimensions, pads to 1536 for compatibility).
    
    Args:
        text: Text to embed
    
    Returns:
        Embedding vector (1536 dimensions) or None if failed
    """
    if not settings.OLLAMA_ENABLED:
        return None
    
    try:
        client = ollama.Client(host=settings.OLLAMA_URL)
        
        # Use nomic-embed-text for embeddings (768-dim)
        # Falls back gracefully if model not available
        response = client.embeddings(
            model="nomic-embed-text",
            prompt=text,
        )
        
        if response and "embedding" in response:
            embedding = response["embedding"]
            # Normalize to 1536 dimensions (pad with zeros for compatibility)
            if len(embedding) < 1536:
                embedding = embedding + [0.0] * (1536 - len(embedding))
            elif len(embedding) > 1536:
                embedding = embedding[:1536]
            return embedding
        
        return None
    
    except Exception as e:
        print(f"[WARN] Embedding generation failed: {e}")
        return None


def retrieve_memory_chunks_by_role(
    db: Session,
    workspace_id: int,
    role_tags: List[str],
    chunk_type: Optional[ChunkType] = None,
    limit: int = 20,
) -> List[MemoryChunk]:
    """
    Retrieve memory chunks for a specific role.
    
    Args:
        db: Database session
        workspace_id: Workspace ID
        role_tags: List of role tags to filter by
        chunk_type: Optional chunk type filter
        limit: Max results
    
    Returns:
        List of matching MemoryChunk objects
    """
    query = db.query(MemoryChunk).filter(MemoryChunk.workspace_id == workspace_id)
    
    if chunk_type:
        query = query.filter(MemoryChunk.chunk_type == chunk_type)
    
    chunks = query.order_by(MemoryChunk.created_at.desc()).limit(limit).all()
    
    # Filter by role tags in metadata
    filtered = []
    for chunk in chunks:
        metadata = chunk.metadata or {}
        chunk_roles = metadata.get("role_tags", [])
        if not chunk_roles or any(role in role_tags for role in chunk_roles):
            filtered.append(chunk)
    
    return filtered
