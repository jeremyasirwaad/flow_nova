"""Logging configuration with Loki integration."""

import json
import logging
import sys
from typing import Any, Dict, Optional

import httpx
from loguru import logger

from app.core.config import settings


class LokiHandler:
    """Custom Loguru handler that sends logs to Grafana Loki."""

    def __init__(
        self,
        url: str,
        labels: Optional[Dict[str, str]] = None,
        timeout: float = 5.0,
    ):
        """
        Initialize Loki handler.

        Args:
            url: Loki push API URL (e.g., http://localhost:3100/loki/api/v1/push)
            labels: Default labels to attach to all log entries
            timeout: HTTP request timeout in seconds
        """
        self.url = url
        self.labels = labels or {}
        self.timeout = timeout
        self.client = httpx.Client(timeout=timeout)

    def __call__(self, message: Any) -> None:
        """
        Process log message and send to Loki.

        Args:
            message: Loguru message record
        """
        try:
            # Extract log data from loguru record
            record = message.record

            # Build labels
            labels = {
                **self.labels,
                "level": record["level"].name.lower(),
                "logger": record["name"],
            }

            # Add source location if available
            if record.get("file"):
                labels["file"] = record["file"].name
            if record.get("function"):
                labels["function"] = record["function"]

            # Build log line
            log_message = record["message"]

            # Add exception info if present
            if record.get("exception"):
                exception_info = record["exception"]
                if exception_info:
                    log_message += f"\n{exception_info}"

            # Prepare Loki payload
            # Timestamp in nanoseconds
            timestamp_ns = str(int(record["time"].timestamp() * 1_000_000_000))

            payload = {
                "streams": [
                    {
                        "stream": labels,
                        "values": [[timestamp_ns, log_message]],
                    }
                ]
            }

            # Send to Loki (non-blocking, fire and forget)
            self.client.post(
                self.url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )

        except Exception as e:
            # Don't let logging errors crash the application
            # Print to stderr as fallback
            print(f"Error sending log to Loki: {e}", file=sys.stderr)

    def __del__(self):
        """Clean up HTTP client."""
        try:
            self.client.close()
        except Exception:
            pass


class InterceptHandler(logging.Handler):
    """
    Intercept standard logging messages and redirect them to Loguru.
    This catches logs from third-party libraries like uvicorn, sqlalchemy, etc.
    """

    def emit(self, record: logging.LogRecord) -> None:
        """Emit a log record by forwarding it to Loguru."""
        # Get corresponding Loguru level if it exists
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where the logged message originated
        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging(
    loki_url: Optional[str] = None,
    app_name: str = "flownova",
    environment: str = "development",
    log_level: str = "INFO",
) -> None:
    """
    Configure application logging with Loki integration.

    Args:
        loki_url: Loki push API URL. If None, only console logging is used.
        app_name: Application name for labels
        environment: Environment name for labels
        log_level: Minimum log level to process
    """
    # Remove default logger
    logger.remove()

    # Add console logger with nice formatting
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
               "<level>{message}</level>",
        level=log_level,
        colorize=True,
    )

    # Add Loki handler if URL is provided
    if loki_url:
        loki_handler = LokiHandler(
            url=loki_url,
            labels={
                "app": app_name,
                "environment": environment,
            },
        )

        # Add Loki handler but FILTER OUT httpx logs to prevent infinite loop
        logger.add(
            loki_handler,
            level=log_level,
            format="{message}",  # Loki will handle formatting
            filter=lambda record: not record["name"].startswith("httpx"),  # Don't send httpx logs to Loki
        )

        logger.info(f"Logging configured with Loki at {loki_url}")
    else:
        logger.info("Logging configured (console only, no Loki)")

    # Intercept standard library logging
    # This catches logs from uvicorn, sqlalchemy, and other libraries
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # Specifically configure known loggers
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access",
                        "sqlalchemy", "sqlalchemy.engine", "fastapi"]:
        logging.getLogger(logger_name).handlers = [InterceptHandler()]
        logging.getLogger(logger_name).propagate = False


def get_logger(name: str):
    """
    Get a logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Loguru logger bound to the given name
    """
    return logger.bind(name=name)
