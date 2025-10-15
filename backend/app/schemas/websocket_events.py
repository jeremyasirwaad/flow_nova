"""WebSocket event schemas for workflow execution notifications."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """WebSocket event types for workflow execution."""

    RUN_STARTED = "run_started"
    RUN_COMPLETED = "run_completed"
    RUN_ERROR = "run_error"

    NODE_STARTED = "node_started"
    NODE_COMPLETED = "node_completed"
    NODE_ERROR = "node_error"

    APPROVAL_NEEDED = "approval_needed"


class WorkflowEvent(BaseModel):
    """Base schema for workflow execution events."""

    event_type: EventType
    run_id: UUID
    workflow_id: UUID
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = Field(default_factory=dict)


class RunStartedEvent(WorkflowEvent):
    """Event emitted when a workflow run starts."""

    event_type: EventType = EventType.RUN_STARTED
    node_id: UUID
    input_data: Optional[Dict[str, Any]] = None


class RunCompletedEvent(WorkflowEvent):
    """Event emitted when a workflow run completes successfully."""

    event_type: EventType = EventType.RUN_COMPLETED
    output_data: Optional[Dict[str, Any]] = None
    duration: Optional[float] = None  # Duration in seconds


class RunErrorEvent(WorkflowEvent):
    """Event emitted when a workflow run encounters an error."""

    event_type: EventType = EventType.RUN_ERROR
    error: str
    node_id: Optional[UUID] = None


class NodeStartedEvent(WorkflowEvent):
    """Event emitted when a node starts executing."""

    event_type: EventType = EventType.NODE_STARTED
    node_id: UUID
    node_type: str
    input_data: Optional[Dict[str, Any]] = None


class NodeCompletedEvent(WorkflowEvent):
    """Event emitted when a node completes execution."""

    event_type: EventType = EventType.NODE_COMPLETED
    node_id: UUID
    node_type: str
    output_data: Optional[Dict[str, Any]] = None
    duration: Optional[float] = None


class NodeErrorEvent(WorkflowEvent):
    """Event emitted when a node encounters an error."""

    event_type: EventType = EventType.NODE_ERROR
    node_id: UUID
    node_type: str
    error: str


class ApprovalNeededEvent(WorkflowEvent):
    """Event emitted when a user approval node needs user input."""

    event_type: EventType = EventType.APPROVAL_NEEDED
    node_id: UUID
    message: str = "Do you want to continue with this workflow?"
