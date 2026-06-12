"""Global rate-limiting middleware — tiered limits per API namespace."""

from __future__ import annotations

import json

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.rate_limit import (
    WINDOW_SECONDS,
    check_request_rate_limit,
    rate_limit_headers,
    should_skip_rate_limit,
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if should_skip_rate_limit(request):
            return await call_next(request)

        result = check_request_rate_limit(request)
        if result and not result.allowed:
            body = json.dumps({
                "detail": "Too many requests. Please try again later.",
                "bucket": result.bucket,
                "retry_after": WINDOW_SECONDS,
            })
            return JSONResponse(
                status_code=429,
                content=json.loads(body),
                headers={
                    **rate_limit_headers(result),
                    "Retry-After": str(WINDOW_SECONDS),
                },
            )

        response = await call_next(request)

        if result:
            for header, value in rate_limit_headers(result).items():
                response.headers[header] = value

        return response