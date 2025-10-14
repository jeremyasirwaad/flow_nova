"""WorkflowRun model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Integer, Float, Index
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class WorkflowRun(Base):
    """WorkflowRun model - tracks execution runs of workflows"""

    __tablename__ = "workflow_runs"

    id = Column(
        UUID(as_uuid=True),  # Stores as UUID in PostgreSQL
        primary_key=True,
        default=uuid4,  # Auto-generates UUID when creating new record
        unique=True,
        nullable=False,
    )

    input_json = Column(JSONB, nullable=True)
    output_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    workflow_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflow_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Relationships
    workflow = relationship("Workflow", back_populates="workflow_runs")
    node = relationship("WorkflowNode", back_populates="workflow_runs")
    ledger_entries = relationship("WorkflowLedger", back_populates="run", cascade="all, delete-orphan")

    # Composite index for common queries
    __table_args__ = (
        Index('ix_workflow_runs_workflow_created', 'workflow_id', 'created_at'),
    )

    def __repr__(self):
        return f"WorkflowRun(id={self.id}, workflow_id={self.workflow_id}, node_id={self.node_id})"
