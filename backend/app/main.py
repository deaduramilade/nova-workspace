from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.cache import health_cache
from app.core.config import settings
from app.core.database import init_db, pool_status
from app.core.performance_middleware import PerformanceMiddleware
from app.core.rate_limit import rate_limiter
from app.core.rate_limit_middleware import RateLimitMiddleware
from app.core.readiness import run_readiness_checks
from app.core.request_limit_middleware import RequestSizeLimitMiddleware
from app.core.security_middleware import SecurityHeadersMiddleware
from app.core.startup_checks import run_startup_security_checks

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.calls import router as calls_router
from app.api.v1.chat import router as chat_router
from app.api.v1.files import router as files_router
from app.api.v1.hr import router as hr_router
from app.api.v1.presence import router as presence_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.streaming import router as streaming_router
from app.api.v1.supervisor import router as supervisor_router
from app.api.v1.sync import router as sync_router
from app.api.v1.users import router as users_router
from app.api.v1.workspaces import router as workspaces_router

load_dotenv()
run_startup_security_checks()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-native collaborative browser workspace",
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json" if settings.EXPOSE_API_DOCS else None,
    docs_url="/api/v1/docs" if settings.EXPOSE_API_DOCS else None,
    redoc_url="/api/v1/redoc" if settings.EXPOSE_API_DOCS else None,
    debug=settings.DEBUG,
)

# Middleware stack (last added = outermost / first to receive request)
if settings.ENABLE_RESPONSE_COMPRESSION:
    app.add_middleware(GZipMiddleware, minimum_size=settings.GZIP_MINIMUM_SIZE)

app.add_middleware(PerformanceMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

if settings.is_production and settings.allowed_hosts_list:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=[
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-RateLimit-Bucket",
        "X-Response-Time",
        "Server-Timing",
    ],
    max_age=600,
)

# Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(workspaces_router, prefix="/api/v1/workspaces", tags=["workspaces"])
app.include_router(sessions_router, prefix="/api/v1/sessions", tags=["sessions"])
app.include_router(streaming_router, prefix="/api/v1/streaming", tags=["streaming"])
app.include_router(supervisor_router, prefix="/api/v1/supervisor", tags=["supervisor"])
app.include_router(sync_router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(chat_router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(calls_router, prefix="/api/v1/calls", tags=["calls"])
app.include_router(files_router, prefix="/api/v1/files", tags=["files"])
app.include_router(presence_router, prefix="/api/v1/presence", tags=["presence"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(hr_router, prefix="/api/v1/hr", tags=["hr"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])


def _health_payload() -> dict:
    return {
        "status": "healthy",
        "service": "Nova Backend",
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
    }


def _security_health_payload() -> dict:
    return {
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "rate_limit_enabled": settings.RATE_LIMIT_ENABLED,
        "api_docs_exposed": settings.EXPOSE_API_DOCS,
        "registration_open": settings.ALLOW_REGISTRATION,
        "cors_origins_count": len(settings.cors_origins_list),
        "trusted_hosts_count": len(settings.allowed_hosts_list),
        "trust_proxy_headers": settings.TRUST_PROXY_HEADERS,
        "hsts_enabled": settings.is_production,
        "password_min_length": settings.PASSWORD_MIN_LENGTH,
        "compression_enabled": settings.ENABLE_RESPONSE_COMPRESSION,
        "performance_middleware": settings.PERFORMANCE_MIDDLEWARE_ENABLED,
        "readiness_strict": settings.PRODUCTION_READINESS_STRICT,
        "max_request_body_bytes": settings.MAX_REQUEST_BODY_BYTES,
    }


def _readiness_payload() -> dict:
    return run_readiness_checks()


@app.get("/api/v1/health")
async def health_check():
    if settings.ENABLE_HEALTH_CACHE:
        return health_cache.get_or_set(
            "health",
            settings.HEALTH_CACHE_TTL_SECONDS,
            _health_payload,
        )
    return _health_payload()


@app.get("/api/v1/health/security")
async def security_health():
    if settings.ENABLE_HEALTH_CACHE:
        return health_cache.get_or_set(
            "health_security",
            settings.HEALTH_CACHE_TTL_SECONDS,
            _security_health_payload,
        )
    return _security_health_payload()


@app.get("/api/v1/health/readiness")
async def readiness_health(response: Response):
    result = _readiness_payload()
    if not result["ready"] and settings.ENVIRONMENT in ("production", "staging"):
        response.status_code = 503
    return result


@app.get("/api/v1/health/production")
async def production_config_summary():
    """Non-sensitive production readiness summary for operators."""
    summary = settings.production_summary()
    readiness = run_readiness_checks()
    summary["ready"] = readiness["ready"]
    summary["checks"] = {k: v["status"] for k, v in readiness["checks"].items()}
    return summary


@app.get("/api/v1/health/performance")
async def performance_health():
    def payload():
        return {
            "rate_limit": {
                "enabled": settings.RATE_LIMIT_ENABLED,
                "active_keys": rate_limiter.stats()["active_keys"],
                "limits": {
                    "auth": settings.RATE_LIMIT_AUTH_PER_MINUTE,
                    "api": settings.RATE_LIMIT_API_PER_MINUTE,
                    "sync": settings.RATE_LIMIT_SYNC_PER_MINUTE,
                    "streaming": settings.RATE_LIMIT_STREAMING_PER_MINUTE,
                    "supervisor": settings.RATE_LIMIT_SUPERVISOR_PER_MINUTE,
                },
            },
            "database_pool": pool_status(),
            "compression": {
                "enabled": settings.ENABLE_RESPONSE_COMPRESSION,
                "min_size_bytes": settings.GZIP_MINIMUM_SIZE,
            },
            "health_cache": {
                "enabled": settings.ENABLE_HEALTH_CACHE,
                "ttl_seconds": settings.HEALTH_CACHE_TTL_SECONDS,
            },
            "slow_request_threshold_ms": settings.SLOW_REQUEST_THRESHOLD_MS,
        }

    if settings.ENABLE_HEALTH_CACHE:
        return health_cache.get_or_set(
            "health_performance",
            settings.HEALTH_CACHE_TTL_SECONDS,
            payload,
        )
    return payload()


@app.on_event("startup")
async def startup_event():
    try:
        init_db()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"⚠️ Database initialization warning: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
        proxy_headers=settings.TRUST_PROXY_HEADERS,
        forwarded_allow_ips="*" if settings.TRUST_PROXY_HEADERS else None,
    )