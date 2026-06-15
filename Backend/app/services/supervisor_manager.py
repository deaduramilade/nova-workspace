"""Supervisor live feedback and oversight tools (Phase 3)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.services.crdt_store import crdt_store
from app.services.presence_manager import presence_manager
from app.services.workspace_hours import get_team_hours, _sessions
from app.services.workspace_live_status import get_live_status
from app.services.neko_service import check_neko_health


SUPERVISOR_ROLES = ("supervisor", "admin", "lead")
HR_ROLES = ("hr", "admin")
FEEDBACK_TYPES = ("nudge", "praise", "flag", "broadcast", "check_in")

_feedback_log: list[dict] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_supervisor(role: str) -> bool:
    return role.lower() in SUPERVISOR_ROLES


def is_hr(role: str) -> bool:
    return role.lower() in HR_ROLES


def _append_feedback(entry: dict) -> dict:
    _feedback_log.insert(0, entry)
    if len(_feedback_log) > 200:
        _feedback_log.pop()
    return entry


async def send_feedback(
    *,
    supervisor: str,
    supervisor_role: str,
    feedback_type: str,
    message: str,
    target_username: Optional[str] = None,
    workspace_id: int = 1,
    priority: str = "normal",
) -> dict:
    if not is_supervisor(supervisor_role) and supervisor_role != "user":
        pass  # demo mode: allow all authenticated users to send for testing
    if feedback_type not in FEEDBACK_TYPES:
        feedback_type = "nudge"

    entry = {
        "id": str(uuid.uuid4()),
        "type": feedback_type,
        "message": message,
        "from": supervisor,
        "to": target_username,
        "workspace_id": workspace_id,
        "priority": priority,
        "created_at": _now(),
        "delivered": False,
        "read": False,
    }

    _append_feedback(entry)

    crdt_store.get_or_create(workspace_id).apply_op({
        "type": "feedback_add",
        "id": entry["id"],
        "payload": entry,
        "node": supervisor,
    })

    ws_payload = {"event": "supervisor_feedback", "feedback": entry}

    if feedback_type == "broadcast":
        delivered = 0
        for conn in list(presence_manager.connections.values()):
            if conn.username != supervisor:
                await presence_manager.send_to_user(conn.username, ws_payload)
                delivered += 1
        entry["delivered"] = delivered > 0
        entry["broadcast_count"] = delivered
    elif target_username:
        ok = await presence_manager.send_to_user(target_username, ws_payload)
        entry["delivered"] = ok
    else:
        directory = presence_manager.get_directory()
        delivered = 0
        for u in directory:
            if u["is_online"] and u["username"] != supervisor:
                await presence_manager.send_to_user(u["username"], ws_payload)
                delivered += 1
        entry["delivered"] = delivered > 0

    return entry


def get_overview() -> dict:
    neko = check_neko_health()
    stats = presence_manager.get_stats()
    active_sessions = len(_sessions)
    team_hours = get_team_hours(1)
    total_hours = sum(m["today_seconds"] for m in team_hours)

    return {
        "updated_at": _now(),
        "phase": 3,
        "integrations": {
            "presence": {"status": "connected", "online": stats.get("online", 0)},
            "neko": {"status": "connected" if neko["online"] else "offline", "latency_ms": neko.get("latency_ms")},
            "crdt_sync": {"status": "ready", "workspaces_tracked": len(crdt_store._docs)},
            "supervisor": {"status": "active", "feedback_count": len(_feedback_log)},
            "working_hours": {"status": "tracking", "active_sessions": active_sessions},
        },
        "metrics": {
            "online_users": stats.get("online", 0),
            "total_users": stats.get("total", 0),
            "active_workspaces": max(1, active_sessions),
            "hours_tracked_today": round(total_hours / 3600, 1),
            "pending_feedback": len([f for f in _feedback_log if not f.get("read")]),
        },
    }


def get_workspace_oversight(workspace_id: int, supervisor: str) -> dict:
    live = get_live_status(workspace_id, current_user=supervisor, current_display_name=supervisor)
    team_hours = get_team_hours(workspace_id)
    crdt_state = crdt_store.get_state(workspace_id)
    recent_feedback = [f for f in _feedback_log if f.get("workspace_id") == workspace_id][:20]

    return {
        "workspace_id": workspace_id,
        "updated_at": _now(),
        "live_status": live,
        "team_hours": team_hours,
        "crdt_version": crdt_state.get("version", 0),
        "recent_feedback": recent_feedback,
        "alerts": [
            m for m in live.get("members", [])
            if m.get("activity", {}).get("code") in ("break", "away")
            or m.get("stream_quality") == "fair"
        ],
    }


def get_recent_feedback(limit: int = 30, workspace_id: Optional[int] = None) -> list[dict]:
    items = _feedback_log
    if workspace_id is not None:
        items = [f for f in items if f.get("workspace_id") == workspace_id]
    return items[:limit]


def mark_feedback_read(feedback_id: str, username: str) -> Optional[dict]:
    for entry in _feedback_log:
        if entry["id"] == feedback_id and (entry.get("to") in (None, username) or entry["type"] == "broadcast"):
            entry["read"] = True
            entry["read_at"] = _now()
            entry["read_by"] = username
            return entry
    return None


supervisor_manager_roles = SUPERVISOR_ROLES
hr_roles = HR_ROLES