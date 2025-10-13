"""WorkflowNode model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Integer, Float
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class WorkflowNode(Base):
    """WorkflowNode model"""

    __tablename__ = "workflow_nodes"

    id = Column(
        UUID(as_uuid=True),  # Stores as UUID in PostgreSQL
        primary_key=True,
        default=uuid4,  # Auto-generates UUID when creating new record
        unique=True,
        nullable=False,
    )

    name = Column(String, nullable=False)
    x_pos = Column(Float)
    y_pos = Column(Float)
    data = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)

    # Relationship back to Workflow
    workflow = relationship("Workflow", back_populates="workflow_nodes")
    

    def __repr__(self):
        return f"WorkflowNode(id={self.id}, name={self.name})"
