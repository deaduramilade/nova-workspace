import random
from datetime import datetime, timezone

from app.services.presence_manager import presence_manager


ACTIVITIES = [
    ("browsing", "Browsing in Neko", "🌐"),
    ("reviewing", "Reviewing documents", "📄"),
    ("coding", "Editing in workspace", "⌨"),
    ("meeting", "In a team meeting", "📋"),
    ("research", "Researching resources", "🔍"),
    ("presenting", "Presenting live demo", "🖥"),
    ("break", "On a short break", "☕"),
]

SIMULATED_MEMBERS = [
    {"username": "johndoe", "display_name": "John Doe"},
    {"username": "alicesmith", "display_name": "Alice Smith"},
    {"username": "michaelchen", "display_name": "Michael Chen"},
    {"username": "sarahlee", "display_name": "Sarah Lee"},
    {"username": "davidkim", "display_name": "David Kim"},
]


def _pick_activity(seed: int) -> dict:
    act = ACTIVITIES[seed % len(ACTIVITIES)]
    return {"code": act[0], "label": act[1], "icon": act[2]}


def get_live_status(
    workspace_id: int,
    current_user: str | None = None,
    current_display_name: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    directory = presence_manager.get_directory()
    live_members: list[dict] = []

    online_map = {u["username"]: u for u in directory if u["is_online"]}

    if current_user:
        presence = online_map.get(current_user)
        live_members.append({
            "username": current_user,
            "display_name": current_display_name or current_user,
            "is_online": True,
            "in_neko": True,
            "workspace_id": workspace_id,
            "activity": {"code": "browsing", "label": "Browsing in Neko", "icon": "🌐"},
            "status_message": presence.get("status_message", "You") if presence else "You",
            "updated_at": now,
            "stream_quality": "excellent",
            "latency_ms": random.randint(12, 35),
            "is_self": True,
        })

    for i, member in enumerate(SIMULATED_MEMBERS):
        if member["username"] == current_user:
            continue
        presence = online_map.get(member["username"])
        is_online = presence is not None if presence else random.random() > 0.35
        seed = hash(f"{workspace_id}:{member['username']}:{datetime.now().minute}") % 1000
        activity = _pick_activity(seed + i)

        if presence and presence.get("status") == "in_call":
            activity = {"code": "call", "label": "In a call", "icon": "📞"}
        elif presence and presence.get("status") == "away":
            activity = {"code": "away", "label": "Away from desk", "icon": "🟡"}

        live_members.append({
            "username": member["username"],
            "display_name": member["display_name"],
            "is_online": is_online,
            "in_neko": is_online and activity["code"] in ("browsing", "coding", "research", "presenting"),
            "workspace_id": workspace_id if is_online and i < 3 else None,
            "activity": activity,
            "status_message": presence.get("status_message", "") if presence else "",
            "updated_at": now,
            "stream_quality": random.choice(["excellent", "good", "fair"]) if is_online else "offline",
            "latency_ms": random.randint(18, 85) if is_online else None,
            "is_self": False,
        })

    active_in_workspace = [m for m in live_members if m["workspace_id"] == workspace_id and m["is_online"]]
    in_neko = [m for m in active_in_workspace if m["in_neko"]]

    return {
        "workspace_id": workspace_id,
        "updated_at": now,
        "members": live_members,
        "summary": {
            "online": len([m for m in live_members if m["is_online"]]),
            "in_workspace": len(active_in_workspace),
            "in_neko_stream": len(in_neko),
            "in_meeting": len([m for m in live_members if m["activity"]["code"] == "meeting"]),
        },
    }