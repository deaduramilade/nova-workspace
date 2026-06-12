from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from app.core.security import verify_token
from app.core.auth import get_current_user
from app.models.user import User
from app.services.presence_manager import presence_manager
from app.services.call_manager import call_manager, CALL_EVENTS

router = APIRouter()


@router.websocket("/ws")
async def presence_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    display_name: str = Query(default="Anonymous"),
):
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    username = payload.get("sub", "anonymous")
    user = await presence_manager.connect(websocket, username, display_name)

    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            if event in CALL_EVENTS:
                await call_manager.handle_event(user, data)
            else:
                await presence_manager.handle_event(user, data)
    except WebSocketDisconnect:
        uname = user.username
        presence_manager.disconnect(user)
        await presence_manager.notify_offline(uname)
    except Exception:
        uname = user.username
        presence_manager.disconnect(user)
        await presence_manager.notify_offline(uname)


@router.get("/directory")
def get_presence_directory(current_user: User = Depends(get_current_user)):
    directory = presence_manager.get_directory()
    stats = presence_manager.get_stats()
    filtered = [u for u in directory if u["username"] != current_user.username]
    return {
        "users": filtered,
        "online": [u for u in filtered if u["is_online"]],
        "offline": [u for u in filtered if not u["is_online"]],
        "stats": stats,
    }


@router.get("/stats")
def get_presence_stats(current_user: User = Depends(get_current_user)):
    return presence_manager.get_stats()


@router.get("/me")
def get_my_presence(current_user: User = Depends(get_current_user)):
    live = presence_manager.get_connection(current_user.username)
    if live:
        return {"presence": presence_manager.serialize(live)}
    directory = presence_manager.get_directory()
    offline = next((u for u in directory if u["username"] == current_user.username), None)
    return {"presence": offline}