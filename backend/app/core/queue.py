"""RQ queue configuration and management."""

from redis import Redis
from rq import Queue

from app.core.config import settings

# Redis connection
redis_conn = Redis.from_url(settings.redis_url)

# Define queues
default_queue = Queue("node-runner", connection=redis_conn)

def get_queue(name: str = "default") -> Queue:
    """Get a queue by name."""
    queues = {
        "node-runner": default_queue
    }
    return queues.get(name, default_queue)
