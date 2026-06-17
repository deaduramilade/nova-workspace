"""
Memory Surfacing Service

Provides role-specific memory summaries for dashboards.
Retrieves relevant decisions, overdue action items, and team insights.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.memory_chunk import MemoryChunk, ChunkType
from app.models.action_item import ActionItem, ActionItemStatus
from app.models.user import User
from app.models.workspace import Workspace


def get_dashboard_memory_summary(
    db: Session,
    workspace_id: int,
    current_user: User,
    days_back: int = 7,
) -> Dict[str, Any]:
    """
    Get a role-specific memory summary for the dashboard.
    
    Includes:
    - Recent relevant decisions
    - Overdue action items
    - Team action item insights (if supervisor/admin)
    
    Args:
        db: Database session
        workspace_id: Workspace ID
        current_user: Current user
        days_back: Number of days to look back for recent items
    
    Returns:
        Dict with summary data
    """
    try:
        # Get recent decisions relevant to user's role
        recent_decisions = get_recent_decisions(
            db=db,
            workspace_id=workspace_id,
            role=current_user.role,
            days_back=days_back,
            limit=5,
        )
        
        # Get overdue action items
        overdue_items = get_overdue_action_items(
            db=db,
            workspace_id=workspace_id,
            current_user=current_user,
        )
        
        # Get team insights if supervisor/admin
        team_insights = None
        if current_user.role in ["supervisor", "administrator"]:
            team_insights = get_team_action_items_summary(
                db=db,
                workspace_id=workspace_id,
            )
        
        return {
            "recent_decisions": recent_decisions,
            "overdue_action_items": overdue_items,
            "team_insights": team_insights,
        }
    
    except Exception as e:
        print(f"[ERROR] Failed to get dashboard memory summary: {e}")
        return {
            "recent_decisions": [],
            "overdue_action_items": [],
            "team_insights": None,
        }


def get_recent_decisions(
    db: Session,
    workspace_id: int,
    role: str,
    days_back: int = 7,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Get recent decisions relevant to a user's role.
    
    Filters by role_tags in metadata.
    
    Args:
        db: Database session
        workspace_id: Workspace ID
        role: User role
        days_back: Number of days to look back
        limit: Max results
    
    Returns:
        List of recent decisions
    """
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
        
        decisions = db.query(MemoryChunk).filter(
            MemoryChunk.workspace_id == workspace_id,
            MemoryChunk.chunk_type == ChunkType.DECISION,
            MemoryChunk.created_at >= cutoff_date,
        ).order_by(MemoryChunk.created_at.desc()).limit(limit).all()
        
        # Filter by role tags
        role_tags = [role, "general"]
        filtered = []
        for decision in decisions:
            metadata = decision.metadata or {}
            chunk_roles = metadata.get("role_tags", [])
            if not chunk_roles or any(r in role_tags for r in chunk_roles):
                filtered.append({
                    "id": decision.id,
                    "content": decision.content,
                    "created_at": decision.created_at.isoformat(),
                    "metadata": metadata,
                })
        
        return filtered
    
    except Exception as e:
        print(f"[WARN] Failed to get recent decisions: {e}")
        return []


def get_overdue_action_items(
    db: Session,
    workspace_id: int,
    current_user: User,
) -> List[Dict[str, Any]]:
    """
    Get overdue action items for the user or their team.
    
    Args:
        db: Database session
        workspace_id: Workspace ID
        current_user: Current user
    
    Returns:
        List of overdue action items
    """
    try:
        now = datetime.now(timezone.utc)
        
        query = db.query(ActionItem).join(ActionItem.memory_chunk).filter(
            MemoryChunk.workspace_id == workspace_id,
            ActionItem.status != ActionItemStatus.COMPLETED,
            ActionItem.status != ActionItemStatus.CANCELLED,
            ActionItem.due_date != None,
            ActionItem.due_date <= now,
        )
        
        # Filter by user role
        if current_user.role not in ["supervisor", "administrator"]:
            query = query.filter(ActionItem.assigned_to_user_id == current_user.id)
        
        overdue = query.order_by(ActionItem.due_date).all()
        
        return [
            {
                "id": item.id,
                "description": item.description,
                "assigned_to": item.assigned_to_user.username if item.assigned_to_user else None,
                "status": item.status.value,
                "due_date": item.due_date.isoformat() if item.due_date else None,
                "days_overdue": (now - item.due_date).days if item.due_date else 0,
            }
            for item in overdue
        ]
    
    except Exception as e:
        print(f"[WARN] Failed to get overdue action items: {e}")
        return []


def get_team_action_items_summary(
    db: Session,
    workspace_id: int,
) -> Dict[str, Any]:
    """
    Get team action items summary for supervisors/admins.
    
    Shows:
    - Total action items
    - By status
    - By assignee
    - Upcoming deadline items
    
    Args:
        db: Database session
        workspace_id: Workspace ID
    
    Returns:
        Team summary dict
    """
    try:
        # Total action items in workspace
        total_items = db.query(ActionItem).join(ActionItem.memory_chunk).filter(
            MemoryChunk.workspace_id == workspace_id,
        ).count()
        
        # By status
        status_breakdown = {}
        for status in ActionItemStatus:
            count = db.query(ActionItem).join(ActionItem.memory_chunk).filter(
                MemoryChunk.workspace_id == workspace_id,
                ActionItem.status == status,
            ).count()
            status_breakdown[status.value] = count
        
        # Upcoming items (due in next 3 days)
        now = datetime.now(timezone.utc)
        upcoming_cutoff = now + timedelta(days=3)
        
        upcoming = db.query(ActionItem).join(ActionItem.memory_chunk).filter(
            MemoryChunk.workspace_id == workspace_id,
            ActionItem.status != ActionItemStatus.COMPLETED,
            ActionItem.status != ActionItemStatus.CANCELLED,
            ActionItem.due_date != None,
            ActionItem.due_date > now,
            ActionItem.due_date <= upcoming_cutoff,
        ).count()
        
        return {
            "total_items": total_items,
            "status_breakdown": status_breakdown,
            "upcoming_items_3days": upcoming,
        }
    
    except Exception as e:
        print(f"[WARN] Failed to get team action items summary: {e}")
        return {
            "total_items": 0,
            "status_breakdown": {},
            "upcoming_items_3days": 0,
        }


def get_relevant_decisions_for_context(
    db: Session,
    workspace_id: int,
    context_keywords: Optional[List[str]] = None,
    role_tags: Optional[List[str]] = None,
    limit: int = 3,
) -> List[Dict[str, Any]]:
    """
    Get decisions relevant to specific context (e.g., for a meeting topic).
    
    Matches decisions by keywords or role tags.
    
    Args:
        db: Database session
        workspace_id: Workspace ID
        context_keywords: Keywords to match in decision content
        role_tags: Role tags to filter by
        limit: Max results
    
    Returns:
        List of relevant decisions
    """
    try:
        decisions = db.query(MemoryChunk).filter(
            MemoryChunk.workspace_id == workspace_id,
            MemoryChunk.chunk_type == ChunkType.DECISION,
        ).order_by(MemoryChunk.created_at.desc()).limit(limit * 3).all()
        
        # Filter by keywords if provided
        if context_keywords:
            keywords_lower = [kw.lower() for kw in context_keywords]
            decisions = [
                d for d in decisions
                if any(kw in d.content.lower() for kw in keywords_lower)
            ]
        
        # Filter by role tags if provided
        if role_tags:
            filtered = []
            for decision in decisions:
                metadata = decision.metadata or {}
                chunk_roles = metadata.get("role_tags", [])
                if not chunk_roles or any(role in role_tags for role in chunk_roles):
                    filtered.append(decision)
            decisions = filtered
        
        # Return top limit results
        return [
            {
                "id": d.id,
                "content": d.content,
                "created_at": d.created_at.isoformat(),
                "meeting_id": d.meeting_id,
            }
            for d in decisions[:limit]
        ]
    
    except Exception as e:
        print(f"[WARN] Failed to get relevant decisions: {e}")
        return []
