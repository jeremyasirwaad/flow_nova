"""User schemas for request/response validation."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, ConfigDict, Field


class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    first_name: str
    last_name: str


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user."""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class UserResponse(BaseModel):
    """Schema for user response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime]


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token payload data."""
    user_id: Optional[UUID] = None
    email: Optional[str] = None
