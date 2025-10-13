"""Task model for example."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func

from app.core.database import Base


class TaskStatus(str, Enum):
    """Task status enum."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Task(Base):
    """Task model."""

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(
        SQLEnum(TaskStatus),
        default=TaskStatus.PENDING,
        nullable=False,
    )
    job_id = Column(String, nullable=True, index=True)  # RQ job ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Task(id={self.id}, title={self.title}, status={self.status})>"
