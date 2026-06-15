from datetime import datetime, timezone
from typing import Optional, Dict, List, Any


# In-memory working hours ledger (resets on server restart)
_sessions: dict[str, dict] = {}
_daily_totals: dict[str, dict[str, int]] = {}
# Approvals: key = f"{username}:{date}" -> {"approved": bool, "approved_by": str, "approved_at": str}
_approvals: dict[str, dict] = {}


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


def _parse_date(d: Optional[str]) -> Optional[str]:
    if not d:
        return None
    try:
        # normalize to YYYY-MM-DD
        return datetime.fromisoformat(d.replace("Z", "+00:00")).date().isoformat() if "T" in d else d
    except Exception:
        return d


def get_employee_work_logs(
    username: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    approved_only: bool = False,
    pending_only: bool = False,
) -> List[dict]:
    """Return detailed work log entries for HR view, with date range and approval filters."""
    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    today = _today_key()
    logs: List[dict] = []

    # From persisted daily totals
    for uname, days in _daily_totals.items():
        if username and uname != username:
            continue
        for day, secs in sorted(days.items()):
            if df and day < df:
                continue
            if dt and day > dt:
                continue
            key = f"{uname}:{day}"
            appr = _approvals.get(key, {})
            is_approved = appr.get("approved", False)
            if approved_only and not is_approved:
                continue
            if pending_only and is_approved:
                continue
            logs.append({
                "id": key,
                "username": uname,
                "display_name": uname.replace("_", " ").title(),
                "date": day,
                "seconds": secs,
                "hours": round(secs / 3600, 2),
                "approved": is_approved,
                "approved_by": appr.get("approved_by"),
                "approved_at": appr.get("approved_at"),
                "source": "daily_total",
            })

    # Include active sessions as "today" pending logs
    for key, sess in list(_sessions.items()):
        uname = sess["username"]
        if username and uname != username:
            continue
        day = today
        if df and day < df or dt and day > dt:
            continue
        started = datetime.fromisoformat(sess["started_at"])
        extra = int((datetime.now(timezone.utc) - started).total_seconds())
        key_a = f"{uname}:{day}"
        appr = _approvals.get(key_a, {})
        is_approved = appr.get("approved", False)
        if approved_only and not is_approved:
            continue
        if pending_only and is_approved:
            continue
        # merge with daily if any
        daily_secs = _daily_totals.get(uname, {}).get(day, 0)
        total = daily_secs + extra
        logs.append({
            "id": f"active:{key_a}",
            "username": uname,
            "display_name": sess.get("display_name", uname.replace("_", " ").title()),
            "date": day,
            "seconds": total,
            "hours": round(total / 3600, 2),
            "approved": is_approved,
            "approved_by": appr.get("approved_by"),
            "approved_at": appr.get("approved_at"),
            "source": "active_session",
            "workspace_id": sess.get("workspace_id"),
            "started_at": sess["started_at"],
        })

    # Dedup active vs daily for same user/day
    seen = set()
    deduped = []
    for log in sorted(logs, key=lambda x: (x["date"], x["username"]), reverse=True):
        k = (log["username"], log["date"])
        if k in seen:
            continue
        seen.add(k)
        deduped.append(log)

    # Simulated data if empty
    if not deduped:
        sim_users = ["johndoe", "alicesmith", "michaelchen"]
        base_date = df or today
        for i, uname in enumerate(sim_users):
            if username and uname != username:
                continue
            secs = 18000 + i * 3000
            deduped.append({
                "id": f"sim:{uname}:{base_date}",
                "username": uname,
                "display_name": uname.replace("_", " ").title(),
                "date": base_date,
                "seconds": secs,
                "hours": round(secs / 3600, 2),
                "approved": False,
                "approved_by": None,
                "approved_at": None,
                "source": "simulated",
            })

    return deduped[:100]  # limit


def approve_employee_hours(username: str, date: str, approved_by: str, approve: bool = True) -> dict:
    """Approve or un-approve a specific employee's hours for a date."""
    d = _parse_date(date) or _today_key()
    key = f"{username}:{d}"
    entry = _approvals.get(key, {})
    entry["approved"] = approve
    entry["approved_by"] = approved_by
    entry["approved_at"] = datetime.now(timezone.utc).isoformat()
    _approvals[key] = entry

    # If approving an active session's day, it stays in daily after end
    return {
        "username": username,
        "date": d,
        "approved": approve,
        "approved_by": approved_by,
        "hours": round((_daily_totals.get(username, {}).get(d, 0)) / 3600, 2),
    }


def get_hr_overview() -> dict:
    """High level stats for HR dashboard."""
    today = _today_key()
    total_today = 0
    active_count = len(_sessions)
    employees = set(_daily_totals.keys()) | {s["username"] for s in _sessions.values()}

    for uname, days in _daily_totals.items():
        total_today += days.get(today, 0)
    for key, sess in _sessions.items():
        started = datetime.fromisoformat(sess["started_at"])
        total_today += int((datetime.now(timezone.utc) - started).total_seconds())

    return {
        "total_employees_tracked": len(employees),
        "active_sessions": active_count,
        "hours_today": round(total_today / 3600, 1),
        "pending_approvals": sum(1 for k, a in _approvals.items() if not a.get("approved")),
        "date": today,
    }