"""Workflow schemas for request/response validation."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkflowNodeCreate(BaseModel):
    """Schema for creating/updating a workflow node."""
    id: Optional[UUID] = None  # If provided, update existing; if None, create new
    name: str = Field(..., min_length=1, max_length=255)
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None
    data: Optional[Dict[str, Any]] = None


class WorkflowNodeResponse(BaseModel):
    """Schema for workflow node response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    x_pos: Optional[float]
    y_pos: Optional[float]
    data: Optional[Dict[str, Any]]
    workflow_id: UUID
    created_at: datetime
    updated_at: Optional[datetime]


class WorkflowEdgeCreate(BaseModel):
    """Schema for creating/updating a workflow edge."""
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[UUID] = None  # If provided, update existing; if None, create new
    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    source_handle: Optional[str] = Field(None, alias="sourceHandle")
    target_handle: Optional[str] = Field(None, alias="targetHandle")


class WorkflowEdgeResponse(BaseModel):
    """Schema for workflow edge response."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: str
    target: str
    source_handle: Optional[str]
    target_handle: Optional[str]
    workflow_id: UUID
    created_at: datetime
    updated_at: Optional[datetime]


class WorkflowBase(BaseModel):
    """Base workflow schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=1000)


class WorkflowCreate(WorkflowBase):
    """Schema for creating a workflow."""
    pass


class WorkflowUpdate(BaseModel):
    """Schema for updating a workflow."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    nodes: Optional[List[WorkflowNodeCreate]] = None
    edges: Optional[List[WorkflowEdgeCreate]] = None


class WorkflowResponse(WorkflowBase):
    """Schema for workflow response."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: Optional[datetime]
    workflow_nodes: List[WorkflowNodeResponse] = []
    workflow_edges: List[WorkflowEdgeResponse] = []


class ApprovalRequest(BaseModel):
    """Schema for user approval decision."""
    decision: str = Field(..., description="User decision: 'yes' or 'no'")

    class Config:
        json_schema_extra = {
            "example": {
                "decision": "yes"
            }
        }
