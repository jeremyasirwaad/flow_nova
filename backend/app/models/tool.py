"""Tool model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Tool(Base):
    """Tool model for storing API tools configuration"""

    __tablename__ = "tools"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        unique=True,
        nullable=False,
    )

    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    api_url = Column(String, nullable=False)
    method = Column(String, nullable=False)  # GET, POST, PUT, DELETE, etc.
    request_body = Column(JSON, nullable=True)  # Optional JSON request body
    headers = Column(JSON, nullable=True)  # Optional JSON headers
    parameters = Column(JSON, nullable=True)  # Array of parameter objects with name and description

    # Foreign key to user
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship to User
    user = relationship("User", back_populates="tools")

    def __repr__(self):
        return f"Tool(id={self.id}, name={self.name}, method={self.method}, api_url={self.api_url}, user_id={self.user_id})"
