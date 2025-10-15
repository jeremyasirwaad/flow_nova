"""Main FastAPI application."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import time
from typing import Union

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import async_engine, Base
from app.core.logging import setup_logging
from app.core.websocket_manager import manager
from app.routes import health, tasks, auth, workflows, websockets, agents, tools


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan events."""
    # Setup logging first
    setup_logging(
        loki_url=settings.loki_url,
        app_name=settings.app_name.lower().replace(" ", "_"),
        environment=settings.environment,
        log_level=settings.log_level,
    )

    # Startup
    logger.info(f"🚀 Starting {settings.app_name}")
    logger.info(f"📊 Environment: {settings.environment}")
    logger.info(f"🔌 Database: {settings.postgres_host}:{settings.postgres_port}/{settings.app_db}")
    logger.info(f"🔴 Redis: {settings.redis_host}:{settings.redis_port}/{settings.redis_db}")

    # Create database tables (for development)
    # In production, use Alembic migrations instead
    if settings.debug:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.debug("Database tables created")

    # Start WebSocket Redis listener for real-time notifications
    await manager.start_redis_listener()
    logger.info("🔌 WebSocket Redis listener started")

    yield

    # Shutdown
    logger.info(f"👋 Shutting down {settings.app_name}")

    # Stop WebSocket Redis listener
    await manager.stop_redis_listener()
    logger.info("🔌 WebSocket Redis listener stopped")

    await async_engine.dispose()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="FlowNova Backend API",
    version="0.1.0",
    lifespan=lifespan,
)

# HTTP Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests and responses."""
    start_time = time.time()

    # Log request
    logger.info(
        f"HTTP {request.method} {request.url.path}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host if request.client else None,
        },
    )

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Log response
    logger.info(
        f"HTTP {request.method} {request.url.path} -> {response.status_code} ({duration:.3f}s)",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration": duration,
        },
    )

    return response


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # Configured via CORS_ORIGINS environment variable
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers - These catch ALL errors and log them to Loki

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions (404, 403, etc.)."""
    logger.warning(
        f"HTTP {exc.status_code}: {exc.detail}",
        extra={
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method,
            "client": request.client.host if request.client else None,
        },
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors (422)."""
    logger.warning(
        f"Validation error on {request.method} {request.url.path}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "errors": exc.errors(),
            "body": str(exc.body) if exc.body else None,
        },
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all uncaught exceptions - THIS IS THE CRASH LOGGER."""
    logger.exception(
        f"UNHANDLED EXCEPTION: {type(exc).__name__}: {str(exc)}",
        extra={
            "exception_type": type(exc).__name__,
            "path": request.url.path,
            "method": request.method,
            "client": request.client.host if request.client else None,
        },
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error": str(exc) if settings.debug else "An error occurred",
        },
    )


# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(workflows.router, prefix="/api", tags=["workflows"])
app.include_router(agents.router, prefix="/api", tags=["agents"])
app.include_router(tools.router, prefix="/api", tags=["tools"])
app.include_router(websockets.router, prefix="/api", tags=["websockets"])

# Optional: Enable test error endpoints for development/testing
# Uncomment the following lines to enable test endpoints
# from app.routes import test_errors
# app.include_router(test_errors.router, prefix="/api", tags=["testing"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "status": "running",
        "environment": settings.environment,
    }
