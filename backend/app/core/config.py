from __future__ import annotations

import secrets
from functools import cached_property
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "staging", "production"]
DeployProfile = Literal["default", "oracle", "oracle-standard"]

WEAK_SECRET_MARKERS = (
    "change",
    "changeme",
    "super-secret",
    "your-super-secret",
    "your-32-byte",
    "please-use",
    "example",
    "test",
    "default",
)


class Settings(BaseSettings):
    # Application
    PROJECT_NAME: str = "Nova Workspace"
    VERSION: str = "0.1.0"
    ENVIRONMENT: Environment = "development"
    DEPLOY_PROFILE: DeployProfile = "default"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://nova_user:nova_secure_password@localhost:5432/nova_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENCRYPTION_KEY: str = "your-32-byte-encryption-key-change-in-production"

    # CORS / hosts (comma-separated strings)
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"
    FRONTEND_URL: str = "http://localhost:3000"
    TRUST_PROXY_HEADERS: bool = False

    # Feature flags
    ALLOW_REGISTRATION: bool = True
    EXPOSE_API_DOCS: bool = True
    EXPOSE_NEKO_SECRETS: bool = True
    MFA_ENABLED: bool = True

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10
    RATE_LIMIT_API_PER_MINUTE: int = 120
    RATE_LIMIT_SYNC_PER_MINUTE: int = 60
    RATE_LIMIT_STREAMING_PER_MINUTE: int = 90
    RATE_LIMIT_SUPERVISOR_PER_MINUTE: int = 30

    # Performance
    PERFORMANCE_MIDDLEWARE_ENABLED: bool = True
    ENABLE_RESPONSE_COMPRESSION: bool = True
    GZIP_MINIMUM_SIZE: int = 1000
    ENABLE_HEALTH_CACHE: bool = True
    HEALTH_CACHE_TTL_SECONDS: int = 5
    SLOW_REQUEST_THRESHOLD_MS: int = 750
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE_SECONDS: int = 3600
    DB_POOL_TIMEOUT: int = 30

    # Security headers
    HSTS_MAX_AGE: int = 31_536_000
    CONTENT_SECURITY_POLICY: str = "default-src 'self'; frame-ancestors 'self'; object-src 'none'"

    # Data retention
    DATA_RETENTION_DAYS: int = 7

    # Neko
    NEKO_URL: str = "http://localhost:5210"
    NEKO_PASSWORD: str = "nova"
    NEKO_ADMIN_PASSWORD: str = "admin"

    # Password policy
    PASSWORD_MIN_LENGTH: int = 10

    # Email / Notifications (for async emails and OTP MFA)
    EMAIL_ENABLED: bool = True
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025  # e.g. mailpit or mailhog for dev; 587 for prod
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@novaworkspace.local"
    EMAIL_USE_TLS: bool = False

    # Server / ops
    LOG_LEVEL: str = "INFO"
    UVICORN_WORKERS: int = 1
    MAX_REQUEST_BODY_BYTES: int = 1_048_576  # 1 MB
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB for file uploads (chat/workspace shares)
    UPLOAD_DIR: str = "volumes/uploads"
    PRODUCTION_READINESS_STRICT: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @cached_property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @cached_property
    def allowed_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def normalize_environment(cls, v: str) -> str:
        return str(v).lower().strip()

    @field_validator("DEPLOY_PROFILE", mode="before")
    @classmethod
    def normalize_deploy_profile(cls, v: str) -> str:
        return str(v).lower().strip()

    @property
    def is_oracle_profile(self) -> bool:
        return self.DEPLOY_PROFILE in ("oracle", "oracle-standard")

    @model_validator(mode="after")
    def apply_environment_defaults(self) -> "Settings":
        if self.is_production:
            object.__setattr__(self, "DEBUG", False)
            if self.EXPOSE_API_DOCS is True and "EXPOSE_API_DOCS" not in self.model_fields_set:
                object.__setattr__(self, "EXPOSE_API_DOCS", False)
            if self.EXPOSE_NEKO_SECRETS is True and "EXPOSE_NEKO_SECRETS" not in self.model_fields_set:
                object.__setattr__(self, "EXPOSE_NEKO_SECRETS", False)
            if self.ALLOW_REGISTRATION is True and "ALLOW_REGISTRATION" not in self.model_fields_set:
                object.__setattr__(self, "ALLOW_REGISTRATION", False)
            if self.TRUST_PROXY_HEADERS is False and "TRUST_PROXY_HEADERS" not in self.model_fields_set:
                object.__setattr__(self, "TRUST_PROXY_HEADERS", True)
            if self.PASSWORD_MIN_LENGTH < 12 and "PASSWORD_MIN_LENGTH" not in self.model_fields_set:
                object.__setattr__(self, "PASSWORD_MIN_LENGTH", 12)
            if self.ACCESS_TOKEN_EXPIRE_MINUTES > 60 and "ACCESS_TOKEN_EXPIRE_MINUTES" not in self.model_fields_set:
                object.__setattr__(self, "ACCESS_TOKEN_EXPIRE_MINUTES", 30)
            if not self.is_oracle_profile and self.UVICORN_WORKERS == 1 and "UVICORN_WORKERS" not in self.model_fields_set:
                object.__setattr__(self, "UVICORN_WORKERS", 2)

        if self.is_oracle_profile:
            self._apply_oracle_defaults()

        return self

    def _apply_oracle_defaults(self) -> None:
        """Tune connection pools and workers for Oracle Always Free memory budgets."""
        compact = self.DEPLOY_PROFILE == "oracle"
        if "UVICORN_WORKERS" not in self.model_fields_set:
            object.__setattr__(self, "UVICORN_WORKERS", 1 if compact else 2)
        if "DB_POOL_SIZE" not in self.model_fields_set:
            object.__setattr__(self, "DB_POOL_SIZE", 5 if compact else 8)
        if "DB_MAX_OVERFLOW" not in self.model_fields_set:
            object.__setattr__(self, "DB_MAX_OVERFLOW", 5 if compact else 8)
        if "LOG_LEVEL" not in self.model_fields_set:
            object.__setattr__(self, "LOG_LEVEL", "WARNING" if compact else "INFO")
        if "RATE_LIMIT_API_PER_MINUTE" not in self.model_fields_set:
            object.__setattr__(self, "RATE_LIMIT_API_PER_MINUTE", 90 if compact else 120)

    def validate_production_secrets(self) -> list[str]:
        """Return list of fatal configuration errors for production."""
        errors: list[str] = []
        if not self.is_production:
            return errors

        if self.DEBUG:
            errors.append("DEBUG must be false in production")

        if len(self.SECRET_KEY) < 32:
            errors.append("SECRET_KEY must be at least 32 characters in production")

        secret_lower = self.SECRET_KEY.lower()
        if any(marker in secret_lower for marker in WEAK_SECRET_MARKERS):
            errors.append("SECRET_KEY appears to be a placeholder — generate a strong random key")

        enc = self.ENCRYPTION_KEY.encode("utf-8")[:32]
        if len(enc) != 32:
            errors.append("ENCRYPTION_KEY must be at least 32 bytes in production")

        enc_lower = self.ENCRYPTION_KEY.lower()
        if any(marker in enc_lower for marker in WEAK_SECRET_MARKERS):
            errors.append("ENCRYPTION_KEY appears to be a placeholder")

        if "*" in self.cors_origins_list:
            errors.append("CORS_ORIGINS must not include '*' in production")

        if not self.cors_origins_list:
            errors.append("CORS_ORIGINS must be set in production")

        if "nova_secure_password" in self.DATABASE_URL:
            errors.append("DATABASE_URL must not use default postgres password in production")

        if self.NEKO_PASSWORD in ("nova", "admin", "password"):
            errors.append("NEKO_PASSWORD must be changed from default in production")

        if self.NEKO_ADMIN_PASSWORD in ("admin", "nova", "password"):
            errors.append("NEKO_ADMIN_PASSWORD must be changed from default in production")

        if self.REDIS_URL and "@" not in self.REDIS_URL.split("://", 1)[-1]:
            if "localhost" not in self.REDIS_URL and "127.0.0.1" not in self.REDIS_URL:
                errors.append("REDIS_URL should include authentication in production")

        if not self.RATE_LIMIT_ENABLED:
            errors.append("RATE_LIMIT_ENABLED must be true in production")

        if not self.ENABLE_RESPONSE_COMPRESSION:
            errors.append("ENABLE_RESPONSE_COMPRESSION should be enabled in production")

        return errors

    def production_summary(self) -> dict:
        return {
            "environment": self.ENVIRONMENT,
            "deploy_profile": self.DEPLOY_PROFILE,
            "debug": self.DEBUG,
            "security": {
                "registration_open": self.ALLOW_REGISTRATION,
                "api_docs_exposed": self.EXPOSE_API_DOCS,
                "neko_secrets_exposed": self.EXPOSE_NEKO_SECRETS,
                "rate_limit_enabled": self.RATE_LIMIT_ENABLED,
                "trust_proxy": self.TRUST_PROXY_HEADERS,
                "password_min_length": self.PASSWORD_MIN_LENGTH,
                "token_expire_minutes": self.ACCESS_TOKEN_EXPIRE_MINUTES,
            },
            "performance": {
                "compression": self.ENABLE_RESPONSE_COMPRESSION,
                "health_cache": self.ENABLE_HEALTH_CACHE,
                "db_pool_size": self.DB_POOL_SIZE,
                "uvicorn_workers": self.UVICORN_WORKERS,
                "gzip_min_bytes": self.GZIP_MINIMUM_SIZE,
            },
            "network": {
                "cors_origins": len(self.cors_origins_list),
                "allowed_hosts": len(self.allowed_hosts_list),
                "frontend_url": self.FRONTEND_URL,
            },
        }

    @staticmethod
    def generate_secret_key() -> str:
        return secrets.token_urlsafe(48)

    @staticmethod
    def generate_encryption_key() -> str:
        return secrets.token_urlsafe(32)[:32]


settings = Settings()