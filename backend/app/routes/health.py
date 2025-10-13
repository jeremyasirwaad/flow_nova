"""Health check endpoints."""

from fastapi import APIRouter, status
from loguru import logger
from redis import Redis
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_engine

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "environment": settings.environment,
    }


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_check():
    """
    Readiness check endpoint.
    Verifies database and Redis connectivity.
    """
    logger.debug("Running readiness check")

    checks = {
        "database": False,
        "redis": False,
    }

    # Check database
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = True
        logger.debug("Database check: PASSED")
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
        logger.error(f"Database check FAILED: {e}")

    # Check Redis
    try:
        redis_conn = Redis.from_url(settings.redis_url)
        redis_conn.ping()
        checks["redis"] = True
        logger.debug("Redis check: PASSED")
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"
        logger.error(f"Redis check FAILED: {e}")

    all_healthy = all(check is True for check in checks.values())

    if not all_healthy:
        logger.warning("Readiness check failed", extra={"checks": checks})

    return {
        "status": "ready" if all_healthy else "not ready",
        "checks": checks,
    }
