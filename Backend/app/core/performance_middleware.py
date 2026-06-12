"""Performance middleware — request timing and slow-request detection."""

from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.PERFORMANCE_MIDDLEWARE_ENABLED:
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        response.headers["Server-Timing"] = f"app;dur={elapsed_ms:.2f}"
        response.headers["X-Response-Time"] = f"{elapsed_ms:.2f}ms"

        if elapsed_ms > settings.SLOW_REQUEST_THRESHOLD_MS:
            response.headers["X-Slow-Request"] = "1"

        return response