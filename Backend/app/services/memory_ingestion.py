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

from app.core.config import settings
from app.models.memory_chunk import MemoryChunk, ChunkType
from app.models.action_item import ActionItem, ActionItemStatus
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_assignment_rule import WorkspaceAssignmentRule, AssignmentRuleType
from app.services.memory_service import bulk_save_memories, extract_memories_from_transcript

try:
    import ollama
except ImportError:  # pragma: no cover - depends on optional local runtime setup
    ollama = None


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
    if not settings.MEMORY_INGESTION_ENABLED:
        return []
    
    # Verify workspace exists
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise MemoryIngestionError(f"Workspace {workspace_id} not found")
    
    try:
        # Prepare metadata with role tags
        chunk_metadata = metadata or {}
        if "role_tags" not in chunk_metadata:
            chunk_metadata["role_tags"] = []
        chunk_metadata["extracted_at"] = datetime.now(timezone.utc).isoformat()
        
        created_chunks = []
        extraction_results = await _extract_elements_from_transcript(transcript)
        
        if extraction_results:
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
                    assigned_user = None
                    
                    # First, try to find user by mentioned name in transcript
                    assignee_name = action_item_data.get("assigned_to")
                    if assignee_name:
                        assigned_user = db.query(User).filter(
                            User.username.ilike(assignee_name)
                        ).first()
                    
                    # If no explicit assignment, apply workspace assignment rules
                    if not assigned_user:
                        assigned_user = await _apply_assignment_rules(
                            db=db,
                            workspace_id=workspace_id,
                            action_description=action_item_data.get("description", ""),
                        )
                    
                    # Create ActionItem if we have an assigned user
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

        extracted_memories = extract_memories_from_transcript(
            transcript=transcript,
            meeting_id=meeting_id,
            workspace_id=workspace_id,
        )
        if extracted_memories:
            _apply_shared_memory_metadata(extracted_memories, chunk_metadata)
            bulk_save_memories(db, extracted_memories)

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
    if not settings.OLLAMA_ENABLED or ollama is None:
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
            chunk_metadata=chunk_metadata,
        )
        db.add(chunk)
        db.flush()  # Get the ID without committing
        return chunk
    
    except Exception as e:
        print(f"[ERROR] Failed to store memory chunk: {e}")
        return None


async def _apply_assignment_rules(
    db: Session,
    workspace_id: int,
    action_description: str,
) -> Optional[User]:
    """
    Apply workspace assignment rules to find the best user for an action item.
    
    Rules are evaluated in priority order (highest first).
    Conditions are checked to see if the rule applies to this action item.
    
    Args:
        db: Database session
        workspace_id: Workspace ID
        action_description: Description of the action item
    
    Returns:
        User to assign to, or None if no rule matches
    """
    try:
        # Get all enabled assignment rules for this workspace, ordered by priority
        rules = db.query(WorkspaceAssignmentRule).filter(
            WorkspaceAssignmentRule.workspace_id == workspace_id,
            WorkspaceAssignmentRule.enabled == True,
        ).order_by(WorkspaceAssignmentRule.priority.desc()).all()
        
        for rule in rules:
            # Check if conditions match
            if not _matches_rule_conditions(rule, action_description):
                continue
            
            # Apply rule based on type
            if rule.rule_type == AssignmentRuleType.ROLE_BASED and rule.target_role:
                # Find first user with target role
                user = db.query(User).filter(User.role == rule.target_role).first()
                if user:
                    return user
            
            elif rule.rule_type == AssignmentRuleType.USER_SPECIFIC and rule.target_user_id:
                # Assign to specific user
                user = db.query(User).filter(User.id == rule.target_user_id).first()
                if user:
                    return user
            
            elif rule.rule_type == AssignmentRuleType.ROUND_ROBIN:
                # Get list of user IDs from criteria and rotate
                user_ids = rule.criteria.get("user_ids", []) if rule.criteria else []
                if user_ids:
                    # Simple round-robin: pick first available user
                    # TODO: Enhance with actual round-robin state tracking
                    user = db.query(User).filter(User.id.in_(user_ids)).first()
                    if user:
                        return user
            
            elif rule.rule_type == AssignmentRuleType.CUSTOM:
                # Custom assignment logic can be defined in criteria
                # For now, just use it as a note
                if rule.target_user_id:
                    user = db.query(User).filter(User.id == rule.target_user_id).first()
                    if user:
                        return user
        
        return None
    
    except Exception as e:
        print(f"[WARN] Failed to apply assignment rules: {e}")
        return None


def _matches_rule_conditions(rule: WorkspaceAssignmentRule, action_description: str) -> bool:
    """
    Check if an action item matches the conditions of an assignment rule.
    
    Args:
        rule: WorkspaceAssignmentRule to check
        action_description: Description of the action item
    
    Returns:
        True if conditions match, False otherwise
    """
    if not rule.conditions:
        return True
    
    conditions = rule.conditions
    description_lower = action_description.lower()
    
    # Check include keywords
    if "keywords" in conditions:
        keywords = conditions["keywords"]
        if keywords and not any(kw.lower() in description_lower for kw in keywords):
            return False
    
    # Check exclude keywords
    if "exclude_keywords" in conditions:
        exclude_keywords = conditions["exclude_keywords"]
        if exclude_keywords and any(kw.lower() in description_lower for kw in exclude_keywords):
            return False
    
    # All conditions match
    return True


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
        metadata = chunk.chunk_metadata or {}
        chunk_roles = metadata.get("role_tags", [])
        if not chunk_roles or any(role in role_tags for role in chunk_roles):
            filtered.append(chunk)
    
    return filtered


def _apply_shared_memory_metadata(
    memories: List[Dict[str, Any]],
    shared_metadata: Dict[str, Any],
) -> None:
    shared_role_tags = shared_metadata.get("role_tags", [])
    for memory in memories:
        metadata = dict(memory.get("metadata") or {})
        role_tags = metadata.get("role_tags", [])
        metadata.update(shared_metadata)
        metadata["role_tags"] = _merge_role_tags(role_tags, shared_role_tags)
        memory["metadata"] = metadata


def _merge_role_tags(*groups: List[str]) -> List[str]:
    seen = set()
    merged = []
    for group in groups:
        for role in group or []:
            cleaned = str(role).strip().lower()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            merged.append(cleaned)
    return merged
