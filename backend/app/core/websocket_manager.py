"""WebSocket connection manager for workflow execution notifications."""

import asyncio
import json
from typing import Dict, Set
from uuid import UUID

from fastapi import WebSocket
from loguru import logger
from redis.asyncio import Redis

from app.core.config import settings


class ConnectionManager:
    """Manages WebSocket connections for workflow notifications."""

    def __init__(self):
        """Initialize the connection manager."""
        # Map of workflow_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.redis: Redis = None
        self.pubsub = None
        self._listener_task = None

    async def connect(self, websocket: WebSocket, workflow_id: UUID):
        """Accept and register a new WebSocket connection for a workflow."""
        await websocket.accept()
        workflow_id_str = str(workflow_id)

        if workflow_id_str not in self.active_connections:
            self.active_connections[workflow_id_str] = set()

        self.active_connections[workflow_id_str].add(websocket)

        logger.info(
            f"WebSocket connected for workflow {workflow_id_str}",
            extra={
                "workflow_id": workflow_id_str,
                "total_connections": len(self.active_connections[workflow_id_str]),
            }
        )

    def disconnect(self, websocket: WebSocket, workflow_id: UUID):
        """Remove a WebSocket connection."""
        workflow_id_str = str(workflow_id)

        if workflow_id_str in self.active_connections:
            self.active_connections[workflow_id_str].discard(websocket)

            # Clean up empty sets
            if not self.active_connections[workflow_id_str]:
                del self.active_connections[workflow_id_str]

            logger.info(
                f"WebSocket disconnected for workflow {workflow_id_str}",
                extra={"workflow_id": workflow_id_str}
            )

    async def send_to_workflow(self, workflow_id: UUID, message: dict):
        """Send a message to all connections for a specific workflow."""
        workflow_id_str = str(workflow_id)

        if workflow_id_str not in self.active_connections:
            return

        # Convert message to JSON string
        message_json = json.dumps(message)

        # Send to all connected clients for this workflow
        disconnected = set()
        for connection in self.active_connections[workflow_id_str]:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(
                    f"Error sending message to WebSocket: {e}",
                    extra={"workflow_id": workflow_id_str, "error": str(e)}
                )
                disconnected.add(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection, workflow_id)

    async def start_redis_listener(self):
        """Start listening to Redis pub/sub for workflow events."""
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.pubsub = self.redis.pubsub()

        # Subscribe to all workflow event channels with pattern matching
        await self.pubsub.psubscribe("workflow_events:*")

        logger.info("Started Redis pub/sub listener for workflow events")

        # Start listening in background
        self._listener_task = asyncio.create_task(self._listen_to_redis())

    async def _listen_to_redis(self):
        """Listen to Redis pub/sub and forward messages to WebSocket clients."""
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "pmessage":
                    # Extract workflow_id from channel name: "workflow_events:workflow-id"
                    channel = message["channel"]
                    workflow_id_str = channel.split(":")[-1]

                    # Parse the event data
                    try:
                        event_data = json.loads(message["data"])

                        logger.debug(
                            f"Received event from Redis: {event_data.get('event_type')}",
                            extra={
                                "workflow_id": workflow_id_str,
                                "run_id": event_data.get("run_id"),
                                "event_type": event_data.get("event_type"),
                            }
                        )

                        # Forward to WebSocket clients
                        try:
                            workflow_id = UUID(workflow_id_str)
                            await self.send_to_workflow(workflow_id, event_data)
                        except ValueError:
                            logger.error(f"Invalid UUID in channel: {workflow_id_str}")

                    except json.JSONDecodeError as e:
                        logger.error(
                            f"Failed to parse Redis message: {e}",
                            extra={"message": message["data"]}
                        )

        except asyncio.CancelledError:
            logger.info("Redis listener task cancelled")
        except Exception as e:
            logger.error(
                f"Error in Redis listener: {e}",
                extra={"error": str(e)}
            )

    async def stop_redis_listener(self):
        """Stop the Redis pub/sub listener."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass

        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()

        if self.redis:
            await self.redis.close()

        logger.info("Stopped Redis pub/sub listener")


# Global connection manager instance
manager = ConnectionManager()
