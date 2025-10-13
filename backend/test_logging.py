#!/usr/bin/env python3
"""Test script to verify Loki logging integration."""

import time
from loguru import logger

from app.core.config import settings
from app.core.logging import setup_logging


def main():
    """Test logging to Loki."""
    print("Setting up logging...")

    # Setup logging with Loki
    setup_logging(
        loki_url=settings.loki_url,
        app_name="test_logging",
        environment=settings.environment,
        log_level="DEBUG",
    )

    print("\n" + "=" * 60)
    print("Sending test logs to Loki...")
    print("=" * 60 + "\n")

    # Test different log levels
    logger.debug("This is a DEBUG message")
    logger.info("This is an INFO message")
    logger.warning("This is a WARNING message")
    logger.error("This is an ERROR message")

    # Test with extra context
    logger.info(
        "User action",
        extra={
            "user_id": 123,
            "action": "test_action",
            "timestamp": time.time(),
        }
    )

    # Test exception logging
    try:
        raise ValueError("This is a test exception")
    except ValueError:
        logger.exception("Caught an exception:")

    print("\n" + "=" * 60)
    print("Test logs sent successfully!")
    print("=" * 60)
    print("\nView logs in Grafana:")
    print("  1. Open http://localhost:3000")
    print("  2. Go to Explore")
    print("  3. Select Loki as data source")
    print("  4. Run query: {app=\"test_logging\"}")
    print()

    # Give some time for logs to be sent
    time.sleep(2)


if __name__ == "__main__":
    main()
