from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.core.auth import get_current_user, require_supervisor, is_supervisor
from app.models.user import User
from app.services.supervisor_manager import (
    FEEDBACK_TYPES,
    get_overview,
    get_recent_feedback,
    get_workspace_oversight,
    mark_feedback_read,
    send_feedback,
)

router = APIRouter(tags=["supervisor"])


class FeedbackRequest(BaseModel):
    type: str = Field(default="nudge", description=f"One of: {', '.join(FEEDBACK_TYPES)}")
    message: str
    target_username: Optional[str] = None
    workspace_id: int = 1
    priority: str = "normal"


@router.get("/overview")
def supervisor_overview(current_user: User = Depends(get_current_user)):
    overview = get_overview()
    overview["role"] = current_user.role
    overview["is_supervisor"] = is_supervisor(current_user.role)
    return overview


@router.get("/workspaces/{workspace_id}/live")
def workspace_live_oversight(workspace_id: int, current_user: User = Depends(get_current_user)):
    return get_workspace_oversight(
        workspace_id,
        current_user.username.replace("_", " ").title(),
    )


@router.post("/feedback")
async def post_feedback(body: FeedbackRequest, current_user: User = require_supervisor()):
    entry = await send_feedback(
        supervisor=current_user.username,
        supervisor_role=current_user.role,
        feedback_type=body.type,
        message=body.message,
        target_username=body.target_username,
        workspace_id=body.workspace_id,
        priority=body.priority,
    )
    return {"status": "sent", "feedback": entry}


@router.get("/feedback/recent")
def recent_feedback(
    workspace_id: Optional[int] = None,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
):
    return {
        "items": get_recent_feedback(limit=limit, workspace_id=workspace_id),
        "is_supervisor": is_supervisor(current_user.role),
    }


@router.post("/feedback/{feedback_id}/read")
def read_feedback(feedback_id: str, current_user: User = Depends(get_current_user)):
    entry = mark_feedback_read(feedback_id, current_user.username)
    if not entry:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"status": "read", "feedback": entry}


@router.get("/tools")
def supervisor_tools(current_user: User = Depends(get_current_user)):
    return {
        "is_supervisor": is_supervisor(current_user.role),
        "feedback_types": [
            {"type": "nudge", "label": "Nudge", "icon": "👋", "description": "Gentle reminder to stay on track"},
            {"type": "praise", "label": "Praise", "icon": "⭐", "description": "Recognize great work"},
            {"type": "flag", "label": "Flag", "icon": "🚩", "description": "Flag a concern for follow-up"},
            {"type": "broadcast", "label": "Broadcast", "icon": "📢", "description": "Message all online teammates"},
            {"type": "check_in", "label": "Check-in", "icon": "✅", "description": "Request a status update"},
        ],
        "role": current_user.role,
    }