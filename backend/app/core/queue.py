"""RQ queue configuration and management."""

from redis import Redis
from rq import Queue

from app.core.config import settings

# Redis connection
redis_conn = Redis.from_url(settings.redis_url)

# Define queues
default_queue = Queue("default", connection=redis_conn)
high_priority_queue = Queue("high", connection=redis_conn)
low_priority_queue = Queue("low", connection=redis_conn)


def get_queue(name: str = "default") -> Queue:
    """Get a queue by name."""
    queues = {
        "default": default_queue,
        "high": high_priority_queue,
        "low": low_priority_queue,
    }
    return queues.get(name, default_queue)
