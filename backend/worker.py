#!/usr/bin/env python3
"""RQ Worker runner script."""

import sys
from redis import Redis
from rq import Worker
from loguru import logger

from app.core.config import settings
from app.core.queue import redis_conn
from app.core.logging import setup_logging


def main():
    """Run RQ worker."""
    # Setup logging
    setup_logging(
        loki_url=settings.loki_url,
        app_name=f"{settings.app_name.lower().replace(' ', '_')}_worker",
        environment=settings.environment,
        log_level=settings.log_level,
    )

    # Get queue names from command line or use default
    queue_names = sys.argv[1:] if len(sys.argv) > 1 else ["default"]

    logger.info(f"🚀 Starting RQ worker for queues: {', '.join(queue_names)}")
    logger.info(f"📡 Redis: {settings.redis_url}")

    # Create worker
    worker = Worker(queue_names, connection=redis_conn)

    # Start worker
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
