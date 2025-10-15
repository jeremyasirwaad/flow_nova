"""Tool schemas for request/response validation."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class ParameterSchema(BaseModel):
    """Schema for LLM extraction parameters."""
    name: str = Field(..., description="Parameter name (e.g., city, date)")
    description: str = Field(..., description="Description for LLM (e.g., The city name to get weather for)")


class ToolBase(BaseModel):
    """Base tool schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Tool name")
    description: str = Field(..., min_length=1, description="Brief description of what this tool does")
    api_url: str = Field(..., description="API endpoint URL")
    method: str = Field(..., description="HTTP method (GET, POST, PUT, DELETE, PATCH)")


class ToolCreate(ToolBase):
    """Schema for creating a new tool."""
    request_body: Optional[Dict[str, Any]] = Field(None, description="Optional JSON request body")
    headers: Optional[Dict[str, Any]] = Field(None, description="Optional JSON headers")
    parameters: Optional[List[ParameterSchema]] = Field(
        None,
        max_length=3,
        description="Parameters for LLM extraction (max 3)"
    )


class ToolUpdate(BaseModel):
    """Schema for updating a tool."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    api_url: Optional[str] = None
    method: Optional[str] = None
    request_body: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, Any]] = None
    parameters: Optional[List[ParameterSchema]] = Field(None, max_length=3)


class ToolResponse(BaseModel):
    """Schema for tool response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    api_url: str
    method: str
    request_body: Optional[Dict[str, Any]]
    headers: Optional[Dict[str, Any]]
    parameters: Optional[List[Dict[str, Any]]]
    created_at: datetime
    updated_at: Optional[datetime]


class ToolListResponse(BaseModel):
    """Schema for list of tools response."""
    tools: List[ToolResponse]
    total: int
