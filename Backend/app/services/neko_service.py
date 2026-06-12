import random
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings


NEKO_URL = settings.NEKO_URL
NEKO_PASSWORD = settings.NEKO_PASSWORD
NEKO_ADMIN_PASSWORD = settings.NEKO_ADMIN_PASSWORD


def build_stream_url(username: str, workspace_id: int, embed: bool = True) -> str:
    params = f"password={NEKO_PASSWORD}&username={username}&workspace={workspace_id}"
    if embed:
        params += "&embed=1"
    return f"{NEKO_URL}/?{params}"


def check_neko_health() -> dict:
    started = datetime.now(timezone.utc)
    health_url = f"{NEKO_URL}/health"
    try:
        req = urllib.request.Request(health_url, method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
            return {
                "online": True,
                "status": "connected",
                "latency_ms": latency_ms,
                "http_status": resp.status,
                "neko_url": NEKO_URL,
                "browser": "firefox",
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
    except urllib.error.HTTPError as e:
        latency_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        return {
            "online": True,
            "status": "reachable",
            "latency_ms": latency_ms,
            "http_status": e.code,
            "neko_url": NEKO_URL,
            "browser": "firefox",
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        return {
            "online": False,
            "status": "offline",
            "latency_ms": None,
            "http_status": None,
            "neko_url": NEKO_URL,
            "browser": "firefox",
            "error": str(exc),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }


def simulate_neko_room(workspace_id: int, participant_count: int) -> dict:
    online = check_neko_health()["online"]
    base_bitrate = random.randint(1800, 4200) if online else 0
    return {
        "room_id": f"neko-ws-{workspace_id}",
        "connected": online,
        "viewers": max(1, participant_count),
        "max_viewers": 12,
        "bitrate_kbps": base_bitrate,
        "fps": random.randint(24, 30) if online else 0,
        "resolution": "1920x1080" if online else "n/a",
        "codec": "VP8/WebRTC",
        "password_protected": True,
    }