"""Workflow model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Workflow(Base):
    """Workflow model"""

    __tablename__ = "workflows"

    id = Column(
        UUID(as_uuid=True),  # Stores as UUID in PostgreSQL
        primary_key=True,
        default=uuid4,  # Auto-generates UUID when creating new record
        unique=True,
        nullable=False,
    )

    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    description = Column(String, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship back to User
    user = relationship("User", back_populates="workflows")

    # Relationships to WorkflowNodes and WorkflowEdges
    workflow_nodes = relationship("WorkflowNode", back_populates="workflow", cascade="all, delete-orphan")
    workflow_edges = relationship("WorkflowEdge", back_populates="workflow", cascade="all, delete-orphan")

    # Relationships to WorkflowRuns and WorkflowLedger
    workflow_runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan")
    ledger_entries = relationship("WorkflowLedger", back_populates="workflow", cascade="all, delete-orphan")
    

    def __repr__(self):
        return f"Workflow(id={self.id}, name={self.name})"
