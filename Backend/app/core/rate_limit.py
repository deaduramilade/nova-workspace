"""Sliding-window rate limiter with path-based rules and standard response headers."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from threading import Lock

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.security_middleware import get_client_ip

WINDOW_SECONDS = 60

EXEMPT_PATHS = frozenset({
    "/api/v1/health",
    "/api/v1/health/security",
    "/api/v1/health/performance",
    "/api/v1/health/readiness",
    "/api/v1/health/production",
})


@dataclass(frozen=True)
class RateLimitRule:
    prefix: str
    bucket: str
    limit: int
    window: int = WINDOW_SECONDS


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_at: int
    bucket: str


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _prune(self, key: str, window: int, now: float) -> None:
        cutoff = now - window
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]

    def check(self, key: str, limit: int, window: int = WINDOW_SECONDS) -> RateLimitResult:
        now = time.time()
        reset_at = int(now) + window

        with self._lock:
            self._prune(key, window, now)
            count = len(self._hits[key])

            if count >= limit:
                return RateLimitResult(
                    allowed=False,
                    limit=limit,
                    remaining=0,
                    reset_at=reset_at,
                    bucket=key.split(":", 1)[0],
                )

            self._hits[key].append(now)
            remaining = max(0, limit - count - 1)
            return RateLimitResult(
                allowed=True,
                limit=limit,
                remaining=remaining,
                reset_at=reset_at,
                bucket=key.split(":", 1)[0],
            )

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def stats(self) -> dict:
        with self._lock:
            return {"active_keys": len(self._hits)}


rate_limiter = SlidingWindowRateLimiter()


def get_rate_limit_rules() -> list[RateLimitRule]:
    return [
        RateLimitRule("/api/v1/auth/", "auth", settings.RATE_LIMIT_AUTH_PER_MINUTE),
        RateLimitRule("/api/v1/sync/", "sync", settings.RATE_LIMIT_SYNC_PER_MINUTE),
        RateLimitRule("/api/v1/supervisor/feedback", "supervisor", settings.RATE_LIMIT_SUPERVISOR_PER_MINUTE),
        RateLimitRule("/api/v1/streaming/", "streaming", settings.RATE_LIMIT_STREAMING_PER_MINUTE),
        RateLimitRule("/api/v1/", "api", settings.RATE_LIMIT_API_PER_MINUTE),
    ]


def resolve_rate_limit_rule(path: str) -> RateLimitRule | None:
    for rule in get_rate_limit_rules():
        if path.startswith(rule.prefix):
            return rule
    return None


def should_skip_rate_limit(request: Request) -> bool:
    if not settings.RATE_LIMIT_ENABLED:
        return True
    if request.method == "OPTIONS":
        return True
    if request.headers.get("upgrade", "").lower() == "websocket":
        return True

    path = request.url.path
    if path in EXEMPT_PATHS:
        return True
    if path.endswith("/ws") or "/ws/" in path:
        return True
    return False


def build_rate_limit_key(request: Request, rule: RateLimitRule) -> str:
    client_ip = get_client_ip(request)
    return f"{rule.bucket}:{client_ip}"


def check_request_rate_limit(request: Request) -> RateLimitResult | None:
    if should_skip_rate_limit(request):
        return None

    rule = resolve_rate_limit_rule(request.url.path)
    if not rule:
        return None

    key = build_rate_limit_key(request, rule)
    return rate_limiter.check(key, rule.limit, rule.window)


def rate_limit_headers(result: RateLimitResult) -> dict[str, str]:
    return {
        "X-RateLimit-Limit": str(result.limit),
        "X-RateLimit-Remaining": str(result.remaining),
        "X-RateLimit-Reset": str(result.reset_at),
        "X-RateLimit-Bucket": result.bucket,
    }


def enforce_rate_limit(request: Request, *, bucket: str, limit: int, window: int = WINDOW_SECONDS) -> RateLimitResult:
    """Endpoint-level enforcement (stricter sub-buckets)."""
    if not settings.RATE_LIMIT_ENABLED:
        return RateLimitResult(True, limit, limit, int(time.time()) + window, bucket)

    client_ip = get_client_ip(request)
    key = f"{bucket}:{client_ip}"
    result = rate_limiter.check(key, limit, window)

    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={**rate_limit_headers(result), "Retry-After": str(window)},
        )

    request.state.rate_limit = result
    return result