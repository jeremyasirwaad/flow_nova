"""Workflow routes for CRUD operations."""

from datetime import datetime
from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User
from app.models.workflow import Workflow
from app.models.workflow_node import WorkflowNode
from app.models.workflow_edge import WorkflowEdge
from app.schemas.workflow import WorkflowCreate, WorkflowResponse, WorkflowUpdate
from app.routes.auth import get_current_active_user

router = APIRouter()


@router.post("/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow_data: WorkflowCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new workflow for the authenticated user with default start and end nodes."""
    workflow = Workflow(
        name=workflow_data.name,
        description=workflow_data.description,
        user_id=current_user.id,
    )

    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    # Create default start node
    start_node = WorkflowNode(
        name="Start Node",
        x_pos=100,
        y_pos=250,
        data={"type": "start", "label": "Start", "description": "Starting point of the workflow"},
        workflow_id=workflow.id,
    )
    db.add(start_node)

    # Create default end node (vertically aligned, 400px to the right)
    end_node = WorkflowNode(
        name="End Node",
        x_pos=500,
        y_pos=250,
        data={"type": "end", "label": "End", "description": "Ending point of the workflow"},
        workflow_id=workflow.id,
    )
    db.add(end_node)

    await db.commit()

    # Fetch the workflow again with nodes and edges loaded
    result = await db.execute(
        select(Workflow)
        .options(
            selectinload(Workflow.workflow_nodes),
            selectinload(Workflow.workflow_edges)
        )
        .where(Workflow.id == workflow.id)
    )
    workflow = result.scalar_one()

    return workflow


@router.get("/workflows", response_model=List[WorkflowResponse])
async def get_workflows(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get all non-deleted workflows for the authenticated user."""
    result = await db.execute(
        select(Workflow)
        .options(
            selectinload(Workflow.workflow_nodes),
            selectinload(Workflow.workflow_edges)
        )
        .where(
            Workflow.user_id == current_user.id,
            Workflow.is_deleted == False
        )
    )
    workflows = result.scalars().all()
    return workflows


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get a specific non-deleted workflow by ID."""
    result = await db.execute(
        select(Workflow)
        .options(
            selectinload(Workflow.workflow_nodes),
            selectinload(Workflow.workflow_edges)
        )
        .where(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id,
            Workflow.is_deleted == False
        )
    )
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )

    return workflow


@router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    workflow_data: WorkflowUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Update a non-deleted workflow with nodes and edges."""
    # Fetch workflow with nodes and edges
    result = await db.execute(
        select(Workflow)
        .options(
            selectinload(Workflow.workflow_nodes),
            selectinload(Workflow.workflow_edges)
        )
        .where(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id,
            Workflow.is_deleted == False
        )
    )
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )

    # Update workflow basic fields
    if workflow_data.name is not None:
        workflow.name = workflow_data.name
    if workflow_data.description is not None:
        workflow.description = workflow_data.description

    # Handle nodes update
    if workflow_data.nodes is not None:
        # Get existing node IDs
        existing_node_ids = {node.id for node in workflow.workflow_nodes}
        incoming_node_ids = {node.id for node in workflow_data.nodes if node.id is not None}

        # Hard delete nodes that are not in the incoming list
        for node in workflow.workflow_nodes:
            if node.id not in incoming_node_ids:
                await db.delete(node)

        # Update or create nodes
        for node_data in workflow_data.nodes:
            if node_data.id and node_data.id in existing_node_ids:
                # Update existing node
                for node in workflow.workflow_nodes:
                    if node.id == node_data.id:
                        node.name = node_data.name
                        node.x_pos = node_data.x_pos
                        node.y_pos = node_data.y_pos
                        node.data = node_data.data
                        break
            else:
                # Create new node
                new_node = WorkflowNode(
                    name=node_data.name,
                    x_pos=node_data.x_pos,
                    y_pos=node_data.y_pos,
                    data=node_data.data,
                    workflow_id=workflow_id,
                )
                db.add(new_node)

    # Handle edges update
    if workflow_data.edges is not None:
        # Get existing edge IDs
        existing_edge_ids = {edge.id for edge in workflow.workflow_edges}
        incoming_edge_ids = {edge.id for edge in workflow_data.edges if edge.id is not None}

        # Hard delete edges that are not in the incoming list
        for edge in workflow.workflow_edges:
            if edge.id not in incoming_edge_ids:
                await db.delete(edge)

        # Update or create edges
        for edge_data in workflow_data.edges:
            if edge_data.id and edge_data.id in existing_edge_ids:
                # Update existing edge
                for edge in workflow.workflow_edges:
                    if edge.id == edge_data.id:
                        edge.source = edge_data.source
                        edge.target = edge_data.target
                        break
            else:
                # Create new edge
                new_edge = WorkflowEdge(
                    source=edge_data.source,
                    target=edge_data.target,
                    workflow_id=workflow_id,
                )
                db.add(new_edge)

    await db.commit()
    await db.refresh(workflow)

    return workflow


@router.delete("/workflows/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a workflow."""
    result = await db.execute(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id,
            Workflow.is_deleted == False
        )
    )
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )

    # Soft delete: mark as deleted instead of removing from database
    workflow.is_deleted = True
    workflow.deleted_at = datetime.utcnow()

    await db.commit()

    return None
