from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/streaming", tags=["streaming"])

@router.get("/join/{workspace_id}")
def join_streaming_session(workspace_id: int, current_user: User = Depends(get_current_user)):
    """Generate connection details for Neko streaming session"""
    return {
        "workspace_id": workspace_id,
        "stream_url": f"http://localhost:5210/?password=nova&username={current_user.username}",
        "neko_url": "http://localhost:5210",
        "status": "ready",
        "message": "Streaming session ready for real-time collaboration"
    }