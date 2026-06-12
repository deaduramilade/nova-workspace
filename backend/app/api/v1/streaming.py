from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.services.presence_manager import presence_manager

router = APIRouter(prefix="/streaming", tags=["streaming"])

NEKO_URL = "http://localhost:5210"
NEKO_PASSWORD = "nova"


@router.get("/join/{workspace_id}")
def join_streaming_session(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    workspace_name = workspace.name if workspace else f"Workspace {workspace_id}"
    workspace_status = workspace.status if workspace else "active"

    participants = presence_manager.get_online_users(exclude=current_user.username)

    return {
        "workspace_id": workspace_id,
        "workspace_name": workspace_name,
        "workspace_status": workspace_status,
        "stream_url": f"{NEKO_URL}/?password={NEKO_PASSWORD}&username={current_user.username}",
        "neko_url": NEKO_URL,
        "status": "ready",
        "session_id": f"ws-{workspace_id}-{current_user.id}",
        "host": current_user.username,
        "participants": participants,
        "participant_count": len(participants) + 1,
        "features": ["browser_stream", "clipboard", "fullscreen", "chat", "presence"],
        "quality": "adaptive",
        "message": "Streaming session ready for real-time collaboration",
    }


@router.get("/status")
def streaming_service_status(current_user: User = Depends(get_current_user)):
    online = len(presence_manager.get_online_users())
    return {
        "neko_url": NEKO_URL,
        "service": "neko-firefox",
        "status": "ready",
        "team_online": online,
        "message": "Neko browser streaming available at port 5210",
    }