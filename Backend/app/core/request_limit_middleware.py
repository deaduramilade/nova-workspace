"""Reject oversized request bodies before they reach route handlers."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                except ValueError:
                    size = 0
                # Use higher limit for file uploads (chat + workspace + call shares)
                is_upload = request.url.path.startswith(("/api/v1/files/upload", "/files/upload"))
                limit = settings.MAX_UPLOAD_SIZE_BYTES if is_upload else settings.MAX_REQUEST_BODY_BYTES
                if size > limit:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "detail": "Request body too large",
                            "max_bytes": limit,
                            "is_upload": is_upload,
                        },
                    )

        return await call_next(request)