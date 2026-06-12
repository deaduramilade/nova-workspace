from __future__ import annotations

import secrets
from functools import cached_property
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "staging", "production"]

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
        return self

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

        return errors

    @staticmethod
    def generate_secret_key() -> str:
        return secrets.token_urlsafe(48)

    @staticmethod
    def generate_encryption_key() -> str:
        return secrets.token_urlsafe(32)[:32]


settings = Settings()