"""Production readiness probes for orchestrators and health checks."""

from __future__ import annotations

import urllib.request
import urllib.error
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def check_database() -> dict:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "message": "connected"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


def check_redis() -> dict:
    if not settings.REDIS_URL:
        return {"status": "skipped", "message": "not configured"}
    try:
        import redis

        client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        client.ping()
        return {"status": "ok", "message": "connected"}
    except Exception as exc:
        return {"status": "degraded", "message": str(exc)}


def check_neko() -> dict:
    url = f"{settings.NEKO_URL.rstrip('/')}/health"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            online = resp.status == 200
            return {"status": "ok" if online else "degraded", "http_status": resp.status}
    except Exception as exc:
        return {"status": "degraded", "message": str(exc)}


def run_readiness_checks() -> dict:
    checks = {
        "database": check_database(),
        "redis": check_redis(),
        "neko": check_neko(),
    }

    critical = [checks["database"]["status"]]
    if settings.is_production and settings.PRODUCTION_READINESS_STRICT:
        critical.append(checks["redis"]["status"])

    ready = all(s == "ok" for s in critical)

    return {
        "ready": ready,
        "timestamp": _now(),
        "environment": settings.ENVIRONMENT,
        "checks": checks,
    }