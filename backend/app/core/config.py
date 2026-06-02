from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Application
    PROJECT_NAME: str = "Nova Workspace"
    VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://nova_user:nova_secure_password@localhost:5432/nova_db"

    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # MFA & Security
    MFA_ENABLED: bool = True

    # Data Retention
    DATA_RETENTION_DAYS: int = 7

    # Encryption
    ENCRYPTION_KEY: str = "your-32-byte-encryption-key-change-in-production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

# Global settings instance
settings = Settings()