#!/usr/bin/env python3
"""Generate production secrets and optionally write backend/.env and root .env."""

from __future__ import annotations

import argparse
import re
import secrets
from pathlib import Path

PROFILES = ("production", "oracle", "oracle-standard")


def _is_ip_address(host: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", host))


def _public_urls(domain: str) -> dict[str, str]:
    """Build CORS and public URLs — IP addresses use http/ws for initial Oracle setup."""
    host = domain.strip().rstrip("/")
    if _is_ip_address(host):
        http_base = f"http://{host}"
        return {
            "CORS_ORIGINS": http_base,
            "ALLOWED_HOSTS": f"{host},localhost",
            "FRONTEND_URL": http_base,
            "NEXT_PUBLIC_API_URL": f"{http_base}/api/v1",
            "NEXT_PUBLIC_WS_URL": f"ws://{host}",
        }
    https_base = f"https://{host}"
    return {
        "CORS_ORIGINS": https_base,
        "ALLOWED_HOSTS": f"{host},localhost",
        "FRONTEND_URL": https_base,
        "NEXT_PUBLIC_API_URL": f"{https_base}/api/v1",
        "NEXT_PUBLIC_WS_URL": f"wss://{host}",
    }


def profile_tuning(profile: str) -> dict[str, str]:
    if profile == "oracle":
        return {
            "DEPLOY_PROFILE": "oracle",
            "UVICORN_WORKERS": "1",
            "DB_POOL_SIZE": "5",
            "DB_MAX_OVERFLOW": "5",
            "LOG_LEVEL": "WARNING",
            "RATE_LIMIT_API_PER_MINUTE": "90",
        }
    if profile == "oracle-standard":
        return {
            "DEPLOY_PROFILE": "oracle-standard",
            "UVICORN_WORKERS": "2",
            "DB_POOL_SIZE": "8",
            "DB_MAX_OVERFLOW": "8",
            "LOG_LEVEL": "INFO",
            "RATE_LIMIT_API_PER_MINUTE": "120",
        }
    return {
        "DEPLOY_PROFILE": "default",
        "UVICORN_WORKERS": "2",
        "DB_POOL_SIZE": "10",
        "DB_MAX_OVERFLOW": "20",
        "LOG_LEVEL": "INFO",
        "RATE_LIMIT_API_PER_MINUTE": "120",
    }


def generate(domain: str = "your-domain.com", profile: str = "production") -> dict[str, str]:
    db_pass = secrets.token_urlsafe(24)
    redis_pass = secrets.token_urlsafe(24)
    urls = _public_urls(domain)
    tuning = profile_tuning(profile)
    return {
        "SECRET_KEY": secrets.token_urlsafe(48),
        "ENCRYPTION_KEY": secrets.token_urlsafe(32)[:32],
        "POSTGRES_PASSWORD": db_pass,
        "REDIS_PASSWORD": redis_pass,
        "NEKO_PASSWORD": secrets.token_urlsafe(16),
        "NEKO_ADMIN_PASSWORD": secrets.token_urlsafe(16),
        "DOMAIN": domain.strip().rstrip("/"),
        "DATABASE_URL": f"postgresql://nova_user:{db_pass}@postgres:5432/nova_db",
        "REDIS_URL": f"redis://:{redis_pass}@redis:6379/0",
        **urls,
        **tuning,
    }


def render_backend_env(secrets_map: dict[str, str], profile: str) -> str:
    compose_file = (
        "docker-compose.oracle.yml"
        if profile.startswith("oracle")
        else "docker-compose.prod.yml"
    )
    return f"""# Auto-generated Nova backend .env — profile: {profile}
# Deploy: docker compose -f {compose_file} up -d --build
ENVIRONMENT=production
DEBUG=False
DEPLOY_PROFILE={secrets_map['DEPLOY_PROFILE']}
PROJECT_NAME=Nova Workspace
LOG_LEVEL={secrets_map['LOG_LEVEL']}

DATABASE_URL={secrets_map['DATABASE_URL']}
REDIS_URL={secrets_map['REDIS_URL']}

SECRET_KEY={secrets_map['SECRET_KEY']}
ENCRYPTION_KEY={secrets_map['ENCRYPTION_KEY']}
ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS={secrets_map['CORS_ORIGINS']}
ALLOWED_HOSTS={secrets_map['ALLOWED_HOSTS']}
FRONTEND_URL={secrets_map['FRONTEND_URL']}
TRUST_PROXY_HEADERS=True

ALLOW_REGISTRATION=False
EXPOSE_API_DOCS=False
EXPOSE_NEKO_SECRETS=False
MFA_ENABLED=True
PASSWORD_MIN_LENGTH=12
PRODUCTION_READINESS_STRICT=True
MAX_REQUEST_BODY_BYTES=1048576

RATE_LIMIT_ENABLED=True
RATE_LIMIT_AUTH_PER_MINUTE=10
RATE_LIMIT_API_PER_MINUTE={secrets_map['RATE_LIMIT_API_PER_MINUTE']}
RATE_LIMIT_SYNC_PER_MINUTE=60
RATE_LIMIT_STREAMING_PER_MINUTE=90
RATE_LIMIT_SUPERVISOR_PER_MINUTE=30

PERFORMANCE_MIDDLEWARE_ENABLED=True
ENABLE_RESPONSE_COMPRESSION=True
GZIP_MINIMUM_SIZE=1000
ENABLE_HEALTH_CACHE=True
HEALTH_CACHE_TTL_SECONDS=5
SLOW_REQUEST_THRESHOLD_MS=750
UVICORN_WORKERS={secrets_map['UVICORN_WORKERS']}

DB_POOL_SIZE={secrets_map['DB_POOL_SIZE']}
DB_MAX_OVERFLOW={secrets_map['DB_MAX_OVERFLOW']}
DB_POOL_RECYCLE_SECONDS=3600
DB_POOL_TIMEOUT=30

NEKO_URL=http://neko:8080
NEKO_PASSWORD={secrets_map['NEKO_PASSWORD']}
NEKO_ADMIN_PASSWORD={secrets_map['NEKO_ADMIN_PASSWORD']}

DATA_RETENTION_DAYS=7
HSTS_MAX_AGE=31536000
CONTENT_SECURITY_POLICY=default-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'
"""


def render_compose_env(secrets_map: dict[str, str]) -> str:
    return f"""# Auto-generated Nova Docker Compose .env
POSTGRES_PASSWORD={secrets_map['POSTGRES_PASSWORD']}
REDIS_PASSWORD={secrets_map['REDIS_PASSWORD']}
NEKO_PASSWORD={secrets_map['NEKO_PASSWORD']}
NEKO_ADMIN_PASSWORD={secrets_map['NEKO_ADMIN_PASSWORD']}
NEXT_PUBLIC_API_URL={secrets_map['NEXT_PUBLIC_API_URL']}
NEXT_PUBLIC_WS_URL={secrets_map['NEXT_PUBLIC_WS_URL']}
NEXT_PUBLIC_APP_ENV=production
DOMAIN={secrets_map['DOMAIN']}
DEPLOY_PROFILE={secrets_map['DEPLOY_PROFILE']}
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Nova production secrets")
    parser.add_argument("--domain", default="your-domain.com", help="Production domain or public IP")
    parser.add_argument(
        "--profile",
        choices=PROFILES,
        default="production",
        help="Deployment profile (oracle = Oracle Free Tier compact)",
    )
    parser.add_argument("--write", action="store_true", help="Write backend/.env and root .env")
    args = parser.parse_args()

    s = generate(args.domain, args.profile)

    print(f"# === Profile: {args.profile} | Domain: {s['DOMAIN']} ===")
    for key in (
        "SECRET_KEY",
        "ENCRYPTION_KEY",
        "POSTGRES_PASSWORD",
        "REDIS_PASSWORD",
        "NEKO_PASSWORD",
        "NEKO_ADMIN_PASSWORD",
    ):
        print(f"{key}={s[key]}")

    if args.write:
        root = Path(__file__).resolve().parent.parent
        backend_env = root / "backend" / ".env"
        compose_env = root / ".env"
        backend_env.write_text(render_backend_env(s, args.profile), encoding="utf-8")
        compose_env.write_text(render_compose_env(s), encoding="utf-8")
        compose_hint = (
            "docker compose -f docker-compose.oracle.yml up -d --build"
            if args.profile.startswith("oracle")
            else "docker compose -f docker-compose.prod.yml up -d --build"
        )
        print(f"\nWrote {backend_env}")
        print(f"Wrote {compose_env}")
        print(f"Next: place TLS certs in deploy/certs/ and run {compose_hint}")
    else:
        print("\n# Run with --write to generate backend/.env and root .env")


if __name__ == "__main__":
    main()