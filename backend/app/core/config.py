"""Configuration settings for the application."""

import os
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "FlowNova"
    environment: str = "dev"
    debug: bool = True
    app_port: int = 8000

    # Database
    postgres_superuser: str = "flownova_admin"
    postgres_superpass: str = "flownova_admin123"
    postgres_port: int = 5432
    postgres_host: str = "localhost"
    app_db: str = "flownova_app_db"
    app_db_password: str = "flownova_app_db"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 1  # Using db 1 for RQ (0 is for LiteLLM)

    # RQ
    rq_dashboard_username: str = "admin"
    rq_dashboard_password: str = "admin"

    # Logging
    loki_url: Optional[str] = "http://localhost:3100/loki/api/v1/push"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        """Get the database URL for SQLAlchemy."""
        return (
            f"postgresql://{self.postgres_superuser}:{self.postgres_superpass}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.app_db}"
        )

    @property
    def async_database_url(self) -> str:
        """Get the async database URL for SQLAlchemy."""
        return (
            f"postgresql+asyncpg://{self.postgres_superuser}:{self.postgres_superpass}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.app_db}"
        )

    @property
    def redis_url(self) -> str:
        """Get the Redis URL for RQ."""
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
