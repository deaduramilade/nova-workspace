from datetime import datetime, timezone
from typing import Optional


# In-memory working hours ledger (resets on server restart)
_sessions: dict[str, dict] = {}
_daily_totals: dict[str, dict[str, int]] = {}


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def start_session(username: str, workspace_id: int, display_name: str) -> dict:
    key = f"{username}:{workspace_id}"
    now = datetime.now(timezone.utc).isoformat()
    _sessions[key] = {
        "username": username,
        "display_name": display_name,
        "workspace_id": workspace_id,
        "started_at": now,
        "last_tick": now,
    }
    return get_session_status(username, workspace_id)


def tick_session(username: str, workspace_id: int, seconds: int = 5) -> Optional[dict]:
    """Heartbeat — session duration is derived from started_at, not tick increments."""
    key = f"{username}:{workspace_id}"
    session = _sessions.get(key)
    if not session:
        return None

    session["last_tick"] = datetime.now(timezone.utc).isoformat()
    return get_session_status(username, workspace_id)


def end_session(username: str, workspace_id: int) -> Optional[dict]:
    key = f"{username}:{workspace_id}"
    session = _sessions.pop(key, None)
    if session:
        started = datetime.fromisoformat(session["started_at"])
        elapsed = int((datetime.now(timezone.utc) - started).total_seconds())
        today = _today_key()
        user_day = _daily_totals.setdefault(username, {})
        user_day[today] = user_day.get(today, 0) + elapsed
    return get_user_hours(username)


def get_session_status(username: str, workspace_id: int) -> dict:
    key = f"{username}:{workspace_id}"
    session = _sessions.get(key)
    today = _today_key()
    today_seconds = _daily_totals.get(username, {}).get(today, 0)

    session_seconds = 0
    if session:
        started = datetime.fromisoformat(session["started_at"])
        session_seconds = int((datetime.now(timezone.utc) - started).total_seconds())

    return {
        "username": username,
        "workspace_id": workspace_id,
        "session_seconds": session_seconds,
        "today_seconds": today_seconds + session_seconds,
        "active": session is not None,
        "started_at": session["started_at"] if session else None,
    }


def get_user_hours(username: str) -> dict:
    today = _today_key()
    user_day = _daily_totals.get(username, {})
    return {
        "username": username,
        "today_seconds": user_day.get(today, 0),
        "week_seconds": sum(user_day.values()),
        "daily_breakdown": user_day,
    }


def get_team_hours(workspace_id: int) -> list[dict]:
    today = _today_key()
    team: list[dict] = []

    for username, days in _daily_totals.items():
        today_secs = days.get(today, 0)
        active_ws = None
        for key, sess in _sessions.items():
            if sess["username"] == username:
                started = datetime.fromisoformat(sess["started_at"])
                extra = int((datetime.now(timezone.utc) - started).total_seconds())
                today_secs += extra
                if sess["workspace_id"] == workspace_id:
                    active_ws = workspace_id
        team.append({
            "username": username,
            "display_name": username.replace("_", " ").title(),
            "today_seconds": today_secs,
            "active_in_workspace": active_ws == workspace_id,
        })

    # Simulated teammates for demo when no real data
    if len(team) < 3:
        sim = [
            ("johndoe", "John Doe", 23400),
            ("alicesmith", "Alice Smith", 15120),
            ("michaelchen", "Michael Chen", 28080),
        ]
        existing = {t["username"] for t in team}
        for uname, dname, secs in sim:
            if uname not in existing:
                team.append({
                    "username": uname,
                    "display_name": dname,
                    "today_seconds": secs + (1800 if uname == "johndoe" else 0),
                    "active_in_workspace": uname == "johndoe",
                    "simulated": True,
                })

    team.sort(key=lambda x: x["today_seconds"], reverse=True)
    return team