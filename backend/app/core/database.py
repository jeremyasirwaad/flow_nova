"""Database configuration and session management."""

from typing import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

# Synchronous engine for Alembic migrations and RQ workers
sync_engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=settings.debug,
)

# Async engine for FastAPI endpoints
async_engine = create_async_engine(
    settings.async_database_url,
    pool_pre_ping=True,
    echo=settings.debug,
)

# Session makers
SyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


# Dependency for FastAPI routes (async)
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for FastAPI routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Sync session for RQ workers
def get_sync_db() -> Session:
    """Provide a synchronous database session for RQ workers."""
    db = SyncSessionLocal()
    try:
        return db
    finally:
        db.close()
