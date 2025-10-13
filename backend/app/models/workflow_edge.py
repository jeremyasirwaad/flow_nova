"""WorkflowEdge model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class WorkflowEdge(Base):
    """WorkflowEdge model"""

    __tablename__ = "workflow_edges"

    id = Column(
        UUID(as_uuid=True),  # Stores as UUID in PostgreSQL
        primary_key=True,
        default=uuid4,  # Auto-generates UUID when creating new record
        unique=True,
        nullable=False,
    )

    source = Column(String, nullable=False)
    target = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)

    # Relationship back to Workflow
    workflow = relationship("Workflow", back_populates="workflow_edges")


    def __repr__(self):
        return f"WorkflowEdge(id={self.id}, source={self.source}, target={self.target})"
