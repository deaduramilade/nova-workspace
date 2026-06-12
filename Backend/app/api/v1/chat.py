from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import verify_token
from app.services.chat_manager import chat_manager

router = APIRouter()


@router.websocket("/ws/{room_id}")
async def chat_websocket(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
    display_name: str = Query(default="Anonymous"),
    team: str = Query(default=None),
):
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    username = payload.get("sub", "anonymous")
    conn = await chat_manager.connect(
        websocket=websocket,
        room_id=room_id,
        username=username,
        display_name=display_name,
        team=team or None,
    )

    try:
        while True:
            data = await websocket.receive_json()
            await chat_manager.handle_message(conn, data)
    except WebSocketDisconnect:
        chat_manager.disconnect(conn)
        await chat_manager._broadcast_system(
            room_id,
            f"{conn.display_name} left the conversation",
        )
    except Exception:
        chat_manager.disconnect(conn)