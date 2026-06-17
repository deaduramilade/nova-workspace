"""
Memory & Meeting Intelligence API endpoints.

Endpoints for ingesting meeting transcripts, retrieving memory chunks, and managing action items.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
import ollama

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.memory_chunk import MemoryChunk, ChunkType
from app.models.action_item import ActionItem, ActionItemStatus
from app.models.workspace_assignment_rule import WorkspaceAssignmentRule, AssignmentRuleType
from app.services.memory_ingestion import (
    ingest_meeting_transcript,
    retrieve_memory_chunks_by_role,
    MemoryIngestionError,
)
from app.services.semantic_search import (
    generate_query_embedding,
    hybrid_search,
)
from app.services.memory_surfacing import (
    get_dashboard_memory_summary,
    get_recent_decisions,
    get_overdue_action_items,
    get_team_action_items_summary,
    get_relevant_decisions_for_context,
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


# -------------------------------------------------------------------
# Workspace Assignment Rules Management
# -------------------------------------------------------------------

@router.get("/assignment-rules")
async def list_assignment_rules(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List assignment rules for a workspace.
    
    Requires: Supervisor or Administrator role
    """
    if current_user.role not in ["supervisor", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    rules = db.query(WorkspaceAssignmentRule).filter(
        WorkspaceAssignmentRule.workspace_id == workspace_id
    ).order_by(WorkspaceAssignmentRule.priority.desc()).all()
    
    return {
        "status": "success",
        "count": len(rules),
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "rule_type": r.rule_type.value,
                "target_role": r.target_role,
                "target_user": r.target_user.username if r.target_user else None,
                "priority": r.priority,
                "enabled": r.enabled,
                "criteria": r.criteria,
                "conditions": r.conditions,
                "created_at": r.created_at.isoformat(),
            }
            for r in rules
        ],
    }


@router.post("/assignment-rules")
async def create_assignment_rule(
    workspace_id: int = Body(...),
    name: str = Body(...),
    rule_type: str = Body(...),
    target_role: Optional[str] = Body(None),
    target_user_id: Optional[int] = Body(None),
    priority: int = Body(100),
    conditions: Optional[dict] = Body(None),
    criteria: Optional[dict] = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new assignment rule for automatic action item assignment.
    
    Requires: Supervisor or Administrator role
    
    Rule Types:
    - role_based: Assign to users with specific role
    - user_specific: Assign to specific user
    - round_robin: Distribute among team members
    - custom: Custom matching criteria
    
    Conditions:
    - keywords: Only apply if action contains these keywords
    - exclude_keywords: Skip if action contains these words
    """
    if current_user.role not in ["supervisor", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        rule_type_enum = AssignmentRuleType(rule_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule_type. Must be one of: {', '.join([rt.value for rt in AssignmentRuleType])}",
        )
    
    rule = WorkspaceAssignmentRule(
        workspace_id=workspace_id,
        name=name,
        rule_type=rule_type_enum,
        target_role=target_role,
        target_user_id=target_user_id,
        priority=priority,
        conditions=conditions or {},
        criteria=criteria or {},
        enabled=True,
    )
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return {
        "status": "success",
        "rule": {
            "id": rule.id,
            "name": rule.name,
            "rule_type": rule.rule_type.value,
            "target_role": rule.target_role,
            "target_user": rule.target_user.username if rule.target_user else None,
            "priority": rule.priority,
            "enabled": rule.enabled,
        },
    }


@router.patch("/assignment-rules/{rule_id}")
async def update_assignment_rule(
    rule_id: int,
    name: Optional[str] = Body(None),
    enabled: Optional[bool] = Body(None),
    priority: Optional[int] = Body(None),
    conditions: Optional[dict] = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update an assignment rule.
    
    Requires: Supervisor or Administrator role
    """
    if current_user.role not in ["supervisor", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    rule = db.query(WorkspaceAssignmentRule).filter(
        WorkspaceAssignmentRule.id == rule_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    if name is not None:
        rule.name = name
    if enabled is not None:
        rule.enabled = enabled
    if priority is not None:
        rule.priority = priority
    if conditions is not None:
        rule.conditions = conditions
    
    db.commit()
    db.refresh(rule)
    
    return {
        "status": "success",
        "rule": {
            "id": rule.id,
            "name": rule.name,
            "rule_type": rule.rule_type.value,
            "enabled": rule.enabled,
            "priority": rule.priority,
        },
    }


@router.delete("/assignment-rules/{rule_id}")
async def delete_assignment_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete an assignment rule.
    
    Requires: Supervisor or Administrator role
    """
    if current_user.role not in ["supervisor", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    rule = db.query(WorkspaceAssignmentRule).filter(
        WorkspaceAssignmentRule.id == rule_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    db.delete(rule)
    db.commit()
    
    return {"status": "success", "message": "Rule deleted"}


# -------------------------------------------------------------------
# Role-Aware Memory Surfacing
# -------------------------------------------------------------------

@router.get("/dashboard-summary")
async def get_dashboard_summary(
    workspace_id: int,
    days_back: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a role-specific memory summary for the dashboard.
    
    Returns:
    - Recent relevant decisions
    - Overdue action items
    - Team action item insights (if supervisor/admin)
    """
    summary = get_dashboard_memory_summary(
        db=db,
        workspace_id=workspace_id,
        current_user=current_user,
        days_back=days_back,
    )
    
    return {
        "status": "success",
        "summary": summary,
    }


@router.get("/recent-decisions")
async def get_recent_decisions_endpoint(
    workspace_id: int,
    days_back: int = 7,
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get recent decisions relevant to the user's role.
    
    Filters by role_tags in metadata.
    """
    decisions = get_recent_decisions(
        db=db,
        workspace_id=workspace_id,
        role=current_user.role,
        days_back=days_back,
        limit=limit,
    )
    
    return {
        "status": "success",
        "count": len(decisions),
        "decisions": decisions,
    }


@router.get("/overdue-action-items")
async def get_overdue_items_endpoint(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get overdue action items for the user or their team.
    
    - Regular users: see only their own
    - Supervisors/Admins: see team's overdue items
    """
    overdue = get_overdue_action_items(
        db=db,
        workspace_id=workspace_id,
        current_user=current_user,
    )
    
    return {
        "status": "success",
        "count": len(overdue),
        "overdue_items": overdue,
    }


@router.get("/team-insights")
async def get_team_insights_endpoint(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get team action items summary for supervisors/admins.
    
    Shows total items, breakdown by status, and upcoming deadlines.
    
    Requires: Supervisor or Administrator role
    """
    if current_user.role not in ["supervisor", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    insights = get_team_action_items_summary(
        db=db,
        workspace_id=workspace_id,
    )
    
    return {
        "status": "success",
        "insights": insights,
    }


@router.post("/relevant-decisions")
async def get_relevant_decisions_endpoint(
    workspace_id: int,
    keywords: Optional[List[str]] = Body(None),
    limit: int = Body(3),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get decisions relevant to specific context/keywords.
    
    Useful for surfacing past decisions when entering a meeting or workspace.
    """
    role_tags = [current_user.role, "general"]
    
    decisions = get_relevant_decisions_for_context(
        db=db,
        workspace_id=workspace_id,
        context_keywords=keywords,
        role_tags=role_tags,
        limit=limit,
    )
    
    return {
        "status": "success",
        "count": len(decisions),
        "decisions": decisions,
    }


# -------------------------------------------------------------------
# Memory Query with LLM Integration
# -------------------------------------------------------------------

@router.post("/query")
async def query_memory(
    workspace_id: int = Body(...),
    query: str = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Query workspace memory using semantic search + LLM reasoning.
    
    This endpoint:
    1. Generates embedding for the query
    2. Performs semantic search on role-filtered memory chunks
    3. Passes relevant chunks + query to Nova LLM
    4. Returns AI-generated answer with source references
    
    Args:
        workspace_id: Workspace to query
        query: User question/query
        current_user: Current user (for role-based filtering)
    
    Returns:
        {
            "status": "success",
            "answer": "AI-generated answer text",
            "sources": [list of source chunks],
            "confidence": 0.0-1.0,
        }
    """
    if not query or len(query.strip()) < 3:
        raise HTTPException(
            status_code=400,
            detail="Query must be at least 3 characters",
        )
    
    # Verify workspace exists
    workspace = db.query(db.query(MemoryChunk).filter(
        MemoryChunk.workspace_id == workspace_id
    ).exists()).scalar()
    
    if not workspace and not db.query(MemoryChunk).filter(
        MemoryChunk.workspace_id == workspace_id
    ).count() > 0:
        # Just check if there's at least one memory chunk in this workspace or proceed anyway
        pass
    
    try:
        # Generate query embedding
        query_embedding = await generate_query_embedding(query)
        
        # Perform hybrid semantic search (with fallback to metadata search)
        search_results = hybrid_search(
            db=db,
            workspace_id=workspace_id,
            query=query,
            query_embedding=query_embedding,
            current_user=current_user,
            limit=5,
        )
        
        if not search_results:
            return {
                "status": "success",
                "answer": "I couldn't find relevant information in the workspace memory. No memory chunks exist for this query.",
                "sources": [],
                "confidence": 0.0,
            }
        
        # Prepare context for LLM
        sources_text = "\n\n".join([
            f"[Chunk {i+1}] ({result.chunk.chunk_type.value})\n{result.chunk.content}"
            for i, result in enumerate(search_results)
        ])
        
        # Generate answer using Nova LLM
        answer = await _generate_memory_answer(
            user_query=query,
            sources_text=sources_text,
            user_role=current_user.role,
        )
        
        # Calculate average confidence from search results
        avg_confidence = (
            sum(r.similarity for r in search_results) / len(search_results)
            if search_results else 0.0
        )
        
        return {
            "status": "success",
            "answer": answer,
            "sources": [result.to_dict() for result in search_results],
            "confidence": min(1.0, avg_confidence),
            "search_count": len(search_results),
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Memory query failed: {str(e)}",
        )


async def _generate_memory_answer(
    user_query: str,
    sources_text: str,
    user_role: str,
) -> str:
    """
    Generate LLM answer from memory chunks.
    
    Args:
        user_query: Original user question
        sources_text: Formatted memory chunk sources
        user_role: User's role (for context)
    
    Returns:
        AI-generated answer string
    """
    if not settings.OLLAMA_ENABLED:
        return "LLM service is unavailable. Please refer to the source documents directly."
    
    # Build role-specific system prompt
    role_prompts = {
        "admin": "You are an administrative assistant with full access to all company information.",
        "supervisor": "You are a supervisor with access to team and project information.",
        "hr": "You are an HR specialist with access to HR-related information.",
        "lead": "You are a team lead with access to team information.",
        "user": "You are a team member with access to relevant work information.",
    }
    
    system_prompt = role_prompts.get(user_role, role_prompts["user"])
    
    prompt = f"""You are Nova, an intelligent workspace assistant. Your role is to help users understand their workspace memory.

{system_prompt}

Based on the following memory excerpts, answer the user's question concisely and accurately.
If the information is insufficient, say so. Always be professional and helpful.

MEMORY EXCERPTS:
{sources_text}

USER QUESTION: {user_query}

ANSWER:"""
    
    try:
        client = ollama.Client(host=settings.OLLAMA_URL)
        response = client.generate(
            model="llama3.2",
            prompt=prompt,
            temperature=0.3,
            top_p=0.9,
            top_k=40,
        )
        
        answer = response.get("response", "").strip()
        return answer if answer else "Unable to generate an answer at this time."
    
    except Exception as e:
        print(f"[WARN] LLM generation failed: {e}")
        return f"Failed to generate answer: {str(e)}"
