"""Production startup validation and readiness logging."""

from __future__ import annotations

import logging
import sys

from app.core.config import settings

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("nova.security")


def run_startup_security_checks() -> None:
    errors = settings.validate_production_secrets()
    if errors:
        msg = "Production configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
        if settings.is_production:
            raise RuntimeError(msg)
        logger.warning(msg)

    logger.info(
        "Nova starting — env=%s debug=%s cors=%d hosts=%d "
        "rate_limit=%s compression=%s workers=%d",
        settings.ENVIRONMENT,
        settings.DEBUG,
        len(settings.cors_origins_list),
        len(settings.allowed_hosts_list),
        settings.RATE_LIMIT_ENABLED,
        settings.ENABLE_RESPONSE_COMPRESSION,
        settings.UVICORN_WORKERS,
    )

    if settings.is_production:
        logger.info("Production hardening active — docs=%s registration=%s", settings.EXPOSE_API_DOCS, settings.ALLOW_REGISTRATION)