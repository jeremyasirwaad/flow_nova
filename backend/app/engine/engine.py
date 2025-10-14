from typing import Dict
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Handle both relative and absolute imports
try:
    from .node_handler import handlers
except ImportError:
    from app.engine.node_handler import handlers

from app.core.queue import get_queue
from app.core.database import get_sync_db
from app.models.workflow import Workflow
from app.models.workflow_node import WorkflowNode
from app.models.workflow_edge import WorkflowEdge
from app.models.user import User  # Import User to resolve relationship


class ExecutionContext:
    """Context object passed to node handlers."""

    def __init__(self, workflow: Dict, context: Dict):
        self.workflow = workflow
        self.context = context


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


def run_node(workflow_id: str, node_id: str, context: Dict):
    """Execute a node and enqueue its next nodes."""

    print("Executing node: ", node_id)
    q = get_queue("node-runner")
    workflow = get_workflow(workflow_id)

    if not workflow:
        return {
            "error": f"Workflow {workflow_id} not found",
            "success": False,
            "reason": "Workflow not found",
        }

    node = get_node(workflow, node_id)

    # Create execution context object
    ctx = ExecutionContext(workflow=workflow, context=context)
    # Execute the node handler
    node_type = node["type"]

    if node_type == "end":
        return {
            "error": None,
            "success": True,
            "reason": "Workflow execution completed",
        }

    result, next_nodes = handlers[node_type](node, ctx)

    # Enqueue next nodes
    for node_id in next_nodes:
        q.enqueue(run_node, workflow_id, node_id, result)

    return {
        "error": None,
        "success": True,
        "reason": "Workflow execution completed",
        "result": result,
    }
