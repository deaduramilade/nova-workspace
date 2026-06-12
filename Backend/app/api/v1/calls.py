from fastapi import APIRouter, WebSocket, Query, Depends
from app.core.auth import get_current_user
from app.models.user import User
from app.services.call_manager import call_manager
from app.services.presence_manager import presence_manager
from app.api.v1.presence import presence_websocket

router = APIRouter()


@router.websocket("/ws")
async def calls_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    display_name: str = Query(default="Anonymous"),
):
    """Legacy calls WebSocket — routes through the unified presence realtime channel."""
    await presence_websocket(websocket, token, display_name)


@router.get("/logs")
def get_call_logs(current_user: User = Depends(get_current_user)):
    return {"logs": call_manager.get_logs_for_user(current_user.username)}


@router.get("/active")
def get_active_calls(current_user: User = Depends(get_current_user)):
    active = [
        c for c in call_manager.get_active_calls()
        if any(p["username"] == current_user.username for p in c["participants"])
    ]
    return {"calls": active}


@router.get("/users")
def get_callable_users(current_user: User = Depends(get_current_user)):
    return {"users": presence_manager.get_online_users(exclude=current_user.username)}


@router.get("/directory")
def get_call_directory(current_user: User = Depends(get_current_user)):
    directory = presence_manager.get_directory()
    filtered = [u for u in directory if u["username"] != current_user.username]
    return {
        "users": filtered,
        "online": [u for u in filtered if u["is_online"]],
        "offline": [u for u in filtered if not u["is_online"]],
        "stats": presence_manager.get_stats(),
    }