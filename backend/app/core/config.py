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

    # Database - No hardcoded credentials
    postgres_superuser: str
    postgres_superpass: str
    postgres_port: int = 5432
    postgres_host: str = "localhost"
    app_db: str
    app_db_password: str

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 1  # Using db 1 for RQ (0 is for LiteLLM)

    # RQ Dashboard - No hardcoded credentials
    rq_dashboard_username: str
    rq_dashboard_password: str

    # Logging
    loki_url: Optional[str] = "http://localhost:3100/loki/api/v1/push"
    log_level: str = "INFO"

    # External services
    models_service_url: str = "http://localhost:4000/v1/models"
    models_service_api_key: Optional[str] = None

    # CORS - comma-separated list of allowed origins
    cors_origins: str = "http://localhost:3001,http://localhost:3000"

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

    @property
    def cors_origins_list(self) -> list[str]:
        """Get CORS origins as a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
