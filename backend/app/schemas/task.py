"""Task schemas for request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    """Schema for creating a new task."""

    title: str
    description: Optional[str] = None


class TaskUpdate(BaseModel):
    """Schema for updating a task."""

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None


class TaskResponse(BaseModel):
    """Schema for task response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    job_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
