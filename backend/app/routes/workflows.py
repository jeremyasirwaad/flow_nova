"""Workflow routes for CRUD operations."""

from datetime import datetime
from typing import Annotated, List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.queue import get_queue
from app.models.user import User
from app.models.workflow import Workflow
from app.models.workflow_node import WorkflowNode
from app.models.workflow_edge import WorkflowEdge
from app.models.workflow_runs import WorkflowRun
from app.models.workflow_ledger import WorkflowLedger
from app.schemas.workflow import WorkflowCreate, WorkflowResponse, WorkflowUpdate, ApprovalRequest
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
        for node in list(workflow.workflow_nodes):
            if node.id not in incoming_node_ids:
                await db.delete(node)

        # Flush deletes
        await db.flush()

        # Update or create nodes
        for node_data in workflow_data.nodes:
            if node_data.id and node_data.id in existing_node_ids:
                # Update existing node - fetch it from DB to ensure we have the right instance
                result = await db.execute(
                    select(WorkflowNode).where(WorkflowNode.id == node_data.id)
                )
                node = result.scalar_one_or_none()
                if node:
                    node.name = node_data.name
                    node.x_pos = node_data.x_pos
                    node.y_pos = node_data.y_pos
                    node.data = node_data.data
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
        # Delete ALL existing edges first
        for edge in workflow.workflow_edges:
            await db.delete(edge)

        # Flush to ensure deletes are processed
        await db.flush()

        # Create all new edges
        for edge_data in workflow_data.edges:
            new_edge = WorkflowEdge(
                source=edge_data.source,
                target=edge_data.target,
                source_handle=edge_data.source_handle,
                target_handle=edge_data.target_handle,
                workflow_id=workflow_id,
            )
            db.add(new_edge)

    await db.commit()

    # Fetch the workflow again with all nodes and edges loaded
    result = await db.execute(
        select(Workflow)
        .options(
            selectinload(Workflow.workflow_nodes),
            selectinload(Workflow.workflow_edges)
        )
        .where(Workflow.id == workflow_id)
    )
    workflow = result.scalar_one()

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


@router.get("/workflows/{workflow_id}/runs")
async def get_workflow_runs(
    workflow_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get all runs for a specific workflow."""
    # Verify workflow exists and belongs to user
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

    # Get all runs for this workflow
    result = await db.execute(
        select(WorkflowRun)
        .where(WorkflowRun.workflow_id == workflow_id)
        .order_by(WorkflowRun.created_at.desc())
    )
    runs = result.scalars().all()

    return [
        {
            "id": str(run.id),
            "workflow_id": str(run.workflow_id),
            "node_id": str(run.node_id),
            "input_json": run.input_json,
            "output_json": run.output_json,
            "created_at": run.created_at.isoformat(),
            "updated_at": run.updated_at.isoformat()
        }
        for run in runs
    ]


@router.get("/runs/{run_id}")
async def get_workflow_run(
    run_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get a specific workflow run by ID."""
    # Fetch the run with workflow relationship
    result = await db.execute(
        select(WorkflowRun)
        .options(selectinload(WorkflowRun.workflow))
        .where(WorkflowRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )

    # Verify the workflow belongs to the current user
    if run.workflow.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return {
        "id": str(run.id),
        "workflow_id": str(run.workflow_id),
        "node_id": str(run.node_id),
        "input_json": run.input_json,
        "output_json": run.output_json,
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat()
    }


@router.get("/runs/{run_id}/ledger")
async def get_workflow_ledger_by_run(
    run_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get all ledger entries for a specific workflow run."""
    # Fetch the run with workflow relationship to verify ownership
    result = await db.execute(
        select(WorkflowRun)
        .options(selectinload(WorkflowRun.workflow))
        .where(WorkflowRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )

    # Verify the workflow belongs to the current user
    if run.workflow.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get all ledger entries for this run
    result = await db.execute(
        select(WorkflowLedger)
        .where(WorkflowLedger.run_id == run_id)
        .order_by(WorkflowLedger.created_at.desc())
    )
    ledger_entries = result.scalars().all()

    return [
        {
            "id": str(entry.id),
            "workflow_id": str(entry.workflow_id),
            "node_id": str(entry.node_id),
            "run_id": str(entry.run_id),
            "node_type": entry.node_type,
            "input_json": entry.input_json,
            "output_json": entry.output_json,
            "tool_calls": entry.tool_calls,
            "created_at": entry.created_at.isoformat(),
            "updated_at": entry.updated_at.isoformat()
        }
        for entry in ledger_entries
    ]


@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    input_data: Dict[str, Any] = Body(default={}),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a workflow and return the run_id.

    The workflow will be executed asynchronously via RQ worker.
    Connect to the WebSocket endpoint with the returned run_id to receive real-time updates.

    Example:
        POST /api/workflows/{workflow_id}/execute
        Body: {"param1": "value1", "param2": "value2"}

        Returns: {"run_id": "uuid-here", "workflow_id": "uuid-here"}

        Then connect to: ws://localhost:8000/api/ws/workflows/{run_id}
    """
    # Verify workflow exists and belongs to user
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

    # Enqueue workflow execution
    # Import here to avoid circular dependency
    from app.engine.engine import run_node

    q = get_queue("node-runner")
    job = q.enqueue(
        run_node,
        str(workflow_id),
        "start_node",
        str(current_user.id),
        input_data,
        None  # run_id will be created by the engine
    )

    return {
        "success": True,
        "message": "Workflow execution started",
        "workflow_id": str(workflow_id),
        "job_id": job.id,
        "note": "The run_id will be available once the workflow starts executing. Connect to the WebSocket endpoint to receive real-time updates."
    }


@router.post("/workflows/{workflow_id}/runs/{run_id}/nodes/{node_id}/approve")
async def approve_workflow_node(
    workflow_id: UUID,
    run_id: UUID,
    node_id: UUID,
    approval_data: ApprovalRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Resume workflow execution after user approval/rejection.

    This endpoint is called when a user approval node is waiting for input.
    It re-enqueues the same node with the user's decision, allowing the
    workflow to continue execution.

    Args:
        workflow_id: The workflow ID
        run_id: The workflow run ID
        node_id: The user approval node ID
        approval_data: Contains the user's decision ('yes' or 'no')

    Returns:
        Success response with run_id
    """
    # Verify workflow exists and belongs to user
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

    # Verify the run exists and belongs to this workflow
    result = await db.execute(
        select(WorkflowRun).where(
            WorkflowRun.id == run_id,
            WorkflowRun.workflow_id == workflow_id
        )
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )

    # Get the most recent ledger entry for this node to retrieve the input
    result = await db.execute(
        select(WorkflowLedger)
        .where(
            WorkflowLedger.run_id == run_id,
            WorkflowLedger.node_id == node_id
        )
        .order_by(WorkflowLedger.created_at.desc())
    )
    ledger_entry = result.scalars().first()

    if not ledger_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ledger entry found for this node"
        )

    # Check if this node is actually waiting for approval
    if ledger_entry.output_json.get("status") != "waiting_for_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This node is not waiting for approval"
        )

    # Prepare input with the user's decision
    input_with_decision = {
        **(ledger_entry.input_json or {}),
        "user_decision": approval_data.decision
    }

    # Re-enqueue the SAME node with the decision
    # This will trigger the second phase of the user_approval_handler
    from app.engine.engine import run_node

    q = get_queue("node-runner")
    job = q.enqueue(
        run_node,
        str(workflow_id),
        str(node_id),  # Resume from the SAME node
        str(current_user.id),
        input_with_decision,
        run_id  # Continue the same run
    )

    return {
        "success": True,
        "message": f"Workflow resumed with decision: {approval_data.decision}",
        "run_id": str(run_id),
        "workflow_id": str(workflow_id),
        "node_id": str(node_id),
        "job_id": job.id
    }


@router.post("/runs/{run_id}/replay")
async def replay_workflow_run(
    run_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Replay a workflow run using the original input data.

    This creates a new workflow run with the same input as the original run,
    executing the workflow with its current structure.

    Args:
        run_id: The ID of the run to replay

    Returns:
        Success response with job information
    """
    # Fetch the run with workflow relationship
    result = await db.execute(
        select(WorkflowRun)
        .options(selectinload(WorkflowRun.workflow))
        .where(WorkflowRun.id == run_id)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )

    # Verify the workflow belongs to the current user
    if run.workflow.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Verify workflow is not deleted
    if run.workflow.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot replay run - workflow has been deleted"
        )

    # Extract original input data
    original_input = run.input_json or {}

    # Enqueue workflow execution with original input
    from app.engine.engine import run_node

    q = get_queue("node-runner")
    job = q.enqueue(
        run_node,
        str(run.workflow_id),
        "start_node",
        str(current_user.id),
        original_input,
        None  # Creates a new run
    )

    return {
        "success": True,
        "message": "Workflow replay started",
        "original_run_id": str(run_id),
        "workflow_id": str(run.workflow_id),
        "job_id": job.id,
        "input_data": original_input,
        "note": "A new run will be created. Connect to the WebSocket endpoint to receive real-time updates."
    }
