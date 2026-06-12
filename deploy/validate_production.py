#!/usr/bin/env python3
"""Pre-flight production readiness validator."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

env_file = ROOT / "backend" / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

from app.core.config import settings  # noqa: E402

CHECKS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str) -> None:
    CHECKS.append((name, ok, detail))
    icon = "OK" if ok else "FAIL"
    print(f"  [{icon}] {name}: {detail}")


def main() -> int:
    profile = settings.DEPLOY_PROFILE
    print(f"Nova Production Readiness Validator (profile: {profile})\n")

    check("environment", settings.ENVIRONMENT == "production", settings.ENVIRONMENT)
    check("debug_off", not settings.DEBUG, f"DEBUG={settings.DEBUG}")
    check("rate_limit", settings.RATE_LIMIT_ENABLED, "enabled")
    check("compression", settings.ENABLE_RESPONSE_COMPRESSION, "enabled")
    check("docs_hidden", not settings.EXPOSE_API_DOCS, f"EXPOSE_API_DOCS={settings.EXPOSE_API_DOCS}")
    check("registration_closed", not settings.ALLOW_REGISTRATION, f"ALLOW_REGISTRATION={settings.ALLOW_REGISTRATION}")
    check("cors_set", len(settings.cors_origins_list) > 0 and "*" not in settings.cors_origins_list, str(settings.cors_origins_list))
    check("hosts_set", len(settings.allowed_hosts_list) > 0, str(settings.allowed_hosts_list))
    check("proxy_trust", settings.TRUST_PROXY_HEADERS, "TRUST_PROXY_HEADERS")

    errors = settings.validate_production_secrets()
    check("secret_validation", len(errors) == 0, "passed" if not errors else "; ".join(errors))

    if settings.is_oracle_profile:
        workers_ok = settings.UVICORN_WORKERS <= 2
        pool_ok = settings.DB_POOL_SIZE <= 10
        check("oracle_workers", workers_ok, f"UVICORN_WORKERS={settings.UVICORN_WORKERS} (max 2)")
        check("oracle_db_pool", pool_ok, f"DB_POOL_SIZE={settings.DB_POOL_SIZE} (max 10)")
        oracle_compose = ROOT / "docker-compose.oracle.yml"
        check("oracle_compose", oracle_compose.exists(), str(oracle_compose.name))

    certs = ROOT / "deploy" / "certs"
    has_cert = (certs / "fullchain.pem").exists() and (certs / "privkey.pem").exists()
    check("tls_certs", has_cert, "deploy/certs/fullchain.pem + privkey.pem" if has_cert else "missing — add before HTTPS")

    failed = [c for c in CHECKS if not c[1]]
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} checks passed")

    if failed:
        print("\nFailed checks:")
        for name, _, detail in failed:
            print(f"  - {name}: {detail}")
        return 1

    print("\nProduction configuration looks ready.")
    if settings.is_oracle_profile:
        cmd = "docker compose -f docker-compose.oracle.yml up -d --build"
        if profile == "oracle-standard":
            cmd = (
                "docker compose -f docker-compose.oracle.yml "
                "-f docker-compose.oracle.standard.yml up -d --build"
            )
        print(f"\nOracle deploy: {cmd}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())