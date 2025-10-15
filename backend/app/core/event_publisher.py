"""Event publisher for workflow execution events via Redis pub/sub."""

import json
from typing import Dict, Any
from uuid import UUID

from redis import Redis
from loguru import logger

from app.core.config import settings
from app.schemas.websocket_events import (
    WorkflowEvent,
    RunStartedEvent,
    RunCompletedEvent,
    RunErrorEvent,
    NodeStartedEvent,
    NodeCompletedEvent,
    NodeErrorEvent,
    ApprovalNeededEvent,
)


class EventPublisher:
    """Publishes workflow execution events to Redis channels."""

    def __init__(self):
        """Initialize Redis connection for publishing."""
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.channel_prefix = "workflow_events"

    def _get_channel_name(self, workflow_id: UUID) -> str:
        """Get Redis channel name for a specific workflow."""
        return f"{self.channel_prefix}:{str(workflow_id)}"

    def _publish_event(self, workflow_id: UUID, event: WorkflowEvent):
        """Publish an event to Redis channel."""
        channel = self._get_channel_name(workflow_id)

        # Convert event to JSON, handling UUID serialization
        event_dict = event.model_dump(mode="json")
        message = json.dumps(event_dict)

        try:
            self.redis.publish(channel, message)
            logger.debug(
                f"Published {event.event_type} event to channel {channel}",
                extra={
                    "event_type": event.event_type,
                    "run_id": str(event.run_id),
                    "workflow_id": str(workflow_id),
                }
            )
        except Exception as e:
            logger.error(
                f"Failed to publish event to Redis: {e}",
                extra={
                    "event_type": event.event_type,
                    "workflow_id": str(workflow_id),
                    "error": str(e),
                }
            )

    # Run lifecycle events

    def publish_run_started(
        self,
        run_id: UUID,
        workflow_id: UUID,
        node_id: UUID,
        input_data: Dict[str, Any] = None
    ):
        """Publish run started event."""
        event = RunStartedEvent(
            run_id=run_id,
            workflow_id=workflow_id,
            node_id=node_id,
            input_data=input_data,
        )
        self._publish_event(workflow_id, event)

    def publish_run_completed(
        self,
        run_id: UUID,
        workflow_id: UUID,
        output_data: Dict[str, Any] = None,
        duration: float = None
    ):
        """Publish run completed event."""
        event = RunCompletedEvent(
            run_id=run_id,
            workflow_id=workflow_id,
            output_data=output_data,
            duration=duration,
        )
        self._publish_event(workflow_id, event)

    def publish_run_error(
        self,
        run_id: UUID,
        workflow_id: UUID,
        error: str,
        node_id: UUID = None
    ):
        """Publish run error event."""
        event = RunErrorEvent(
            run_id=run_id,
            workflow_id=workflow_id,
            error=error,
            node_id=node_id,
        )
        self._publish_event(workflow_id, event)

    # Node execution events

    def publish_node_started(
        self,
        run_id: UUID,
        workflow_id: UUID,
        node_id: UUID,
        node_type: str,
        input_data: Dict[str, Any] = None
    ):
        """Publish node started event."""
        event = NodeStartedEvent(
            run_id=run_id,
            workflow_id=workflow_id,
            node_id=node_id,
            node_type=node_type,
            input_data=input_data,
        )
        self._publish_event(workflow_id, event)

    def publish_node_completed(
        self,
        run_id: UUID,
        workflow_id: UUID,
        node_id: UUID,
        node_type: str,
        output_data: Dict[str, Any] = None,
        duration: float = None
    ):
        """Publish node completed event."""
        event = NodeCompletedEvent(
            run_id=run_id,
            workflow_id=workflow_id,
            node_id=node_id,
            node_type=node_type,
            output_data=output_data,
            duration=duration,
        )
        self._publish_event(workflow_id, event)

    def publish_node_error(
        self,
        run_id: UUID,
        workflow_id: UUID,
        node_id: UUID,
        node_type: str,
        error: str
    ):
        """Publish node error event."""
        event = NodeErrorEvent(
            run_id=run_id,
            workflow_id=workflow_id,
            node_id=node_id,
            node_type=node_type,
            error=error,
        )
        self._publish_event(workflow_id, event)

    def publish_approval_needed(
        self,
        run_id: UUID,
        workflow_id: UUID,
        node_id: UUID,
        message: str = "Do you want to continue with this workflow?"
    ):
        """Publish approval needed event for user approval nodes."""
        event = ApprovalNeededEvent(
            run_id=run_id,
            workflow_id=workflow_id,
            node_id=node_id,
            message=message,
        )
        self._publish_event(workflow_id, event)


# Global event publisher instance
_event_publisher = None


def get_event_publisher() -> EventPublisher:
    """Get or create the global event publisher instance."""
    global _event_publisher
    if _event_publisher is None:
        _event_publisher = EventPublisher()
    return _event_publisher
