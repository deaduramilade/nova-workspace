from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.services.presence_manager import presence_manager
from app.services.neko_service import (
    NEKO_URL,
    NEKO_PASSWORD,
    NEKO_ADMIN_PASSWORD,
    build_stream_url,
    check_neko_health,
    simulate_neko_room,
)
from app.services.workspace_hours import (
    start_session,
    tick_session,
    end_session,
    get_session_status,
    get_team_hours,
)
from app.services.workspace_live_status import get_live_status

router = APIRouter(tags=["streaming"])


@router.get("/join/{workspace_id}")
def join_streaming_session(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    workspace_name = workspace.name if workspace else f"Workspace {workspace_id}"
    workspace_status = workspace.status if workspace else "active"

    display_name = current_user.username.replace("_", " ").title()
    participants = presence_manager.get_online_users(exclude=current_user.username)
    neko_health = check_neko_health()
    neko_room = simulate_neko_room(workspace_id, len(participants) + 1)
    hours = start_session(current_user.username, workspace_id, display_name)

    return {
        "workspace_id": workspace_id,
        "workspace_name": workspace_name,
        "workspace_status": workspace_status,
        "stream_url": build_stream_url(current_user.username, workspace_id),
        "neko_url": NEKO_URL,
        "neko_password": NEKO_PASSWORD,
        "neko_admin_password": NEKO_ADMIN_PASSWORD,
        "status": "ready" if neko_health["online"] else "neko_offline",
        "session_id": f"ws-{workspace_id}-{current_user.id}",
        "host": current_user.username,
        "host_display_name": display_name,
        "participants": participants,
        "participant_count": len(participants) + 1,
        "features": ["browser_stream", "clipboard", "fullscreen", "chat", "presence", "working_hours"],
        "quality": "adaptive" if neko_health["online"] else "degraded",
        "message": "Streaming session ready" if neko_health["online"] else "Neko offline — start Docker container",
        "neko": {**neko_health, "room": neko_room},
        "working_hours": hours,
    }


@router.get("/neko/health")
def neko_health(
    workspace_id: int = 1,
    current_user: User = Depends(get_current_user),
):
    health = check_neko_health()
    online_count = len(presence_manager.get_online_users()) + 1
    room = simulate_neko_room(workspace_id, online_count)
    return {**health, "password": NEKO_PASSWORD, "service": "m1k1o/neko:firefox", "room": room}


@router.get("/live-status/{workspace_id}")
def workspace_live_status(workspace_id: int, current_user: User = Depends(get_current_user)):
    return get_live_status(
        workspace_id,
        current_user=current_user.username,
        current_display_name=current_user.username.replace("_", " ").title(),
    )


@router.get("/working-hours/{workspace_id}")
def workspace_working_hours(workspace_id: int, current_user: User = Depends(get_current_user)):
    mine = get_session_status(current_user.username, workspace_id)
    team = get_team_hours(workspace_id)
    return {
        "workspace_id": workspace_id,
        "mine": mine,
        "team": team,
        "team_total_today_seconds": sum(m["today_seconds"] for m in team),
    }


@router.post("/working-hours/{workspace_id}/tick")
def workspace_hours_tick(workspace_id: int, current_user: User = Depends(get_current_user)):
    result = tick_session(current_user.username, workspace_id, seconds=1)
    if not result:
        start_session(current_user.username, workspace_id, current_user.username)
        result = tick_session(current_user.username, workspace_id, seconds=1)
    return result or {}


@router.post("/working-hours/{workspace_id}/end")
def workspace_hours_end(workspace_id: int, current_user: User = Depends(get_current_user)):
    return end_session(current_user.username, workspace_id)


@router.get("/status")
def streaming_service_status(current_user: User = Depends(get_current_user)):
    neko = check_neko_health()
    online = len(presence_manager.get_online_users())
    return {
        "neko_url": NEKO_URL,
        "service": "neko-firefox",
        "status": neko["status"],
        "neko_online": neko["online"],
        "team_online": online,
        "message": "Neko browser streaming available" if neko["online"] else "Neko container not reachable",
    }