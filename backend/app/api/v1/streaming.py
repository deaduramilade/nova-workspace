from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/streaming", tags=["Streaming"])

@router.get("/join/{workspace_id}")
def join_streaming_session(workspace_id: int, current_user: User = Depends(get_current_user)):
    """Return Neko streaming connection details"""
    return {
        "workspace_id": workspace_id,
        "stream_url": f"http://localhost:5210/?password=nova&username={current_user.username}",
        "status": "connected",
        "message": "Streaming session ready. Connect via WebRTC in frontend."
    }