"""Tool routes for CRUD operations."""

from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.tool import Tool
from app.schemas.tool import ToolCreate, ToolResponse, ToolUpdate, ToolListResponse
from app.routes.auth import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.post("/tools", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def create_tool(
    tool_data: ToolCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new tool for the authenticated user."""
    # Convert parameters to dict format if provided
    parameters_dict = None
    if tool_data.parameters:
        parameters_dict = [param.model_dump() for param in tool_data.parameters]

    tool = Tool(
        name=tool_data.name,
        description=tool_data.description,
        api_url=tool_data.api_url,
        method=tool_data.method.upper(),
        request_body=tool_data.request_body,
        headers=tool_data.headers,
        parameters=parameters_dict,
        user_id=current_user.id,
    )

    db.add(tool)
    await db.commit()
    await db.refresh(tool)

    return tool


@router.get("/tools", response_model=ToolListResponse)
async def get_tools(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get all tools for the authenticated user."""
    # Get total count for current user
    count_result = await db.execute(
        select(func.count(Tool.id)).where(Tool.user_id == current_user.id)
    )
    total = count_result.scalar()

    # Get all tools for current user
    result = await db.execute(
        select(Tool)
        .where(Tool.user_id == current_user.id)
        .order_by(Tool.created_at.desc())
    )
    tools = result.scalars().all()

    return {"tools": tools, "total": total}


@router.get("/tools/{tool_id}", response_model=ToolResponse)
async def get_tool(
    tool_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get a specific tool by ID for the authenticated user."""
    result = await db.execute(
        select(Tool).where(Tool.id == tool_id, Tool.user_id == current_user.id)
    )
    tool = result.scalar_one_or_none()

    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )

    return tool


@router.put("/tools/{tool_id}", response_model=ToolResponse)
async def update_tool(
    tool_id: UUID,
    tool_data: ToolUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Update a tool for the authenticated user."""
    result = await db.execute(
        select(Tool).where(Tool.id == tool_id, Tool.user_id == current_user.id)
    )
    tool = result.scalar_one_or_none()

    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )

    # Update only provided fields
    update_data = tool_data.model_dump(exclude_unset=True)

    # Handle parameters conversion
    if "parameters" in update_data and update_data["parameters"] is not None:
        update_data["parameters"] = [param for param in update_data["parameters"]]

    # Update method to uppercase if provided
    if "method" in update_data and update_data["method"] is not None:
        update_data["method"] = update_data["method"].upper()

    for key, value in update_data.items():
        setattr(tool, key, value)

    await db.commit()
    await db.refresh(tool)

    return tool


@router.delete("/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(
    tool_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Delete a tool for the authenticated user."""
    result = await db.execute(
        select(Tool).where(Tool.id == tool_id, Tool.user_id == current_user.id)
    )
    tool = result.scalar_one_or_none()

    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found"
        )

    await db.delete(tool)
    await db.commit()

    return None
