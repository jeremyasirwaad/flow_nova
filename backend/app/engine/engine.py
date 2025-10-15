from typing import Dict, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import time

# Handle both relative and absolute imports
try:
    from .node_handler import handlers
except ImportError:
    from app.engine.node_handler import handlers

from app.core.queue import get_queue
from app.core.database import get_sync_db
from app.core.event_publisher import get_event_publisher
from app.models.workflow import Workflow
from app.models.workflow_node import WorkflowNode
from app.models.workflow_edge import WorkflowEdge
from app.models.workflow_runs import WorkflowRun
from app.models.workflow_ledger import WorkflowLedger
from app.models.user import User  # Import User to resolve relationship


class ExecutionContext:
    """Context object passed to node handlers."""

    def __init__(self, workflow: Dict, user_id: str, node_id: str, input: Dict, output: Dict, run_id: Optional[UUID] = None):
        self.workflow = workflow
        self.output = output
        self.user_id = user_id
        self.input = input
        self.node_id = node_id
        self.run_id = run_id
        self.start_time = time.time()  # Track execution time


def get_workflow(workflow_id: str):
    """Retrieve workflow with its nodes and edges.

    Returns a dictionary format suitable for the workflow engine.
    """
    db = get_sync_db()

    try:
        result = db.execute(
            select(Workflow)
            .options(
                selectinload(Workflow.workflow_nodes),
                selectinload(Workflow.workflow_edges),
            )
            .where(Workflow.id == workflow_id, Workflow.is_deleted == False)
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            return None

        # Convert to dictionary format expected by run_node
        return {
            "id": str(workflow.id),
            "name": workflow.name,
            "nodes": {
                str(node.id): {
                    "id": str(node.id),
                    "type": node.data.get("type") if node.data else None,
                    "data": node.data or {},
                }
                for node in workflow.workflow_nodes
            },
            "edges": [
                {
                    "source_handle": edge.source_handle,
                    "target_handle": edge.target_handle,
                    "source": edge.source,
                    "target": edge.target,
                }
                for edge in workflow.workflow_edges
            ],
        }
    finally:
        db.close()


def get_start_node(workflow):
    """Find and return the start node from the workflow."""
    for node_id, node in workflow["nodes"].items():
        if node["type"] == "start":
            return node
    return None


def get_node(workflow, node_id):
    """Find and return the start node from the workflow."""
    if node_id == "start_node":
        return get_start_node(workflow)
    return workflow["nodes"].get(node_id, None)


def create_run(workflow_id: str, node_id: str, input_json: Dict) -> UUID:
    """Create a new workflow run record.

    Args:
        workflow_id: The workflow ID
        node_id: The starting node ID
        input_json: Initial input data for the workflow run

    Returns:
        UUID: The created run ID
    """
    db = get_sync_db()

    try:
        workflow_run = WorkflowRun(
            workflow_id=workflow_id,
            node_id=node_id,
            input_json=input_json,
            output_json=None  # Will be updated when workflow completes
        )
        db.add(workflow_run)
        db.commit()
        db.refresh(workflow_run)

        run_id = workflow_run.id

        # Publish run started event
        try:
            publisher = get_event_publisher()
            publisher.publish_run_started(
                run_id=run_id,
                workflow_id=UUID(workflow_id),
                node_id=UUID(node_id),
                input_data=input_json
            )
        except Exception as e:
            print(f"Failed to publish run_started event: {e}")

        return run_id
    finally:
        db.close()


def create_ledger_entry(workflow_id: str, node_id: str, run_id: UUID, node_type: str, input_json: Dict, output_json: Dict, tool_calls: Dict = None):
    """Create a workflow ledger entry to track node execution.

    Args:
        workflow_id: The workflow ID
        node_id: The node ID that was executed
        run_id: The run ID this execution belongs to
        node_type: The type of the node (start, end, agent, if_else, etc.)
        input_json: Input data for the node
        output_json: Output data from the node
        tool_calls: Tool call information if any (optional)
    """
    db = get_sync_db()

    try:
        ledger_entry = WorkflowLedger(
            workflow_id=workflow_id,
            node_id=node_id,
            run_id=run_id,
            node_type=node_type,
            input_json=input_json,
            output_json=output_json,
            tool_calls=tool_calls
        )
        db.add(ledger_entry)
        db.commit()
    finally:
        db.close()




def run_node(workflow_id: str, node_id: str, user_id: str, input: dict, run_id: Optional[UUID] = None):
    """Execute a node and enqueue its next nodes."""

    print("Executing node: ", node_id)
    q = get_queue("node-runner")
    workflow = get_workflow(workflow_id)
    publisher = get_event_publisher()

    if not workflow:
        return {
            "error": f"Workflow {workflow_id} not found",
            "success": False,
            "reason": "Workflow not found",
        }

    node = get_node(workflow, node_id)

    # If this is the start node and no run_id exists, create a new run
    if node_id == "start_node" and run_id is None:
        run_id = create_run(
            workflow_id=workflow_id,
            node_id=node["id"],
            input_json=input
        )
        print(f"Created new workflow run: {run_id}")

    # Create execution context object with run_id
    ctx = ExecutionContext(
        workflow=workflow,
        user_id=user_id,
        node_id=node_id,
        input=input,
        output={},
        run_id=run_id
    )

    # Execute the node handler
    node_type = node["type"]
    node_start_time = time.time()

    # Publish node started event
    if run_id:
        try:
            publisher.publish_node_started(
                run_id=run_id,
                workflow_id=UUID(workflow_id),
                node_id=UUID(node["id"]),
                node_type=node_type,
                input_data=input
            )
        except Exception as e:
            print(f"Failed to publish node_started event: {e}")

    try:
        if node_type == "end":
            # Create ledger entry for end node
            if run_id:
                create_ledger_entry(
                    workflow_id=workflow_id,
                    node_id=node["id"],
                    run_id=run_id,
                    node_type=node_type,
                    input_json=input,
                    output_json=input
                )

                # Publish node completed event
                node_duration = time.time() - node_start_time
                try:
                    publisher.publish_node_completed(
                        run_id=run_id,
                        workflow_id=UUID(workflow_id),
                        node_id=UUID(node["id"]),
                        node_type=node_type,
                        output_data=ctx.output,
                        duration=node_duration
                    )
                except Exception as e:
                    print(f"Failed to publish node_completed event: {e}")

                # Publish run completed event
                try:
                    publisher.publish_run_completed(
                        run_id=run_id,
                        workflow_id=UUID(workflow_id),
                        output_data=ctx.output
                    )
                except Exception as e:
                    print(f"Failed to publish run_completed event: {e}")

            return {
                "error": None,
                "success": True,
                "reason": "Workflow execution completed",
                "run_id": str(run_id) if run_id else None,
            }

        # Execute node handler
        ctx, next_nodes = handlers[node_type](node, ctx)

        # Publish node completed event
        node_duration = time.time() - node_start_time
        if run_id:
            try:
                publisher.publish_node_completed(
                    run_id=run_id,
                    workflow_id=UUID(workflow_id),
                    node_id=UUID(node["id"]),
                    node_type=node_type,
                    output_data=ctx.output,
                    duration=node_duration
                )
            except Exception as e:
                print(f"Failed to publish node_completed event: {e}")

        # Enqueue next nodes with run_id
        # Pass ctx.output to next nodes so data flows through the workflow
        for next_node_id in next_nodes:
            q.enqueue(run_node, workflow_id, next_node_id, user_id, ctx.output, run_id)

        return {
            "error": None,
            "success": True,
            "reason": "Node execution completed",
            "run_id": str(run_id) if run_id else None,
            "result": {
                "output": ctx.output,
                "input": ctx.input
            },
        }

    except Exception as e:
        # Publish node error event
        if run_id:
            try:
                publisher.publish_node_error(
                    run_id=run_id,
                    workflow_id=UUID(workflow_id),
                    node_id=UUID(node["id"]),
                    node_type=node_type,
                    error=str(e)
                )
            except Exception as pub_error:
                print(f"Failed to publish node_error event: {pub_error}")

            # Publish run error event
            try:
                publisher.publish_run_error(
                    run_id=run_id,
                    workflow_id=UUID(workflow_id),
                    error=str(e),
                    node_id=UUID(node["id"])
                )
            except Exception as pub_error:
                print(f"Failed to publish run_error event: {pub_error}")

        # Re-raise the exception
        raise
