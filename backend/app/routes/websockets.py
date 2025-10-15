"""WebSocket routes for real-time workflow execution notifications."""

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from loguru import logger

from app.core.websocket_manager import manager

router = APIRouter()


@router.websocket("/ws/workflows/{workflow_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    workflow_id: UUID,
    token: str = Query(None, description="Optional authentication token")
):
    """
    WebSocket endpoint for receiving real-time workflow execution updates.

    Connect to this endpoint to receive live updates for ALL runs of a workflow:
    - run_started: When a workflow run begins (includes run_id)
    - node_started: When each node starts executing (includes run_id)
    - node_completed: When each node completes (includes run_id)
    - node_error: When a node encounters an error (includes run_id)
    - run_completed: When the entire workflow completes (includes run_id)
    - run_error: When the workflow encounters an error (includes run_id)

    All events include both workflow_id and run_id so you can track individual runs.

    Args:
        workflow_id: The UUID of the workflow to monitor
        token: Optional authentication token (can be used for user verification)

    Example:
        ws://localhost:8000/api/ws/workflows/{workflow_id}?token=your-auth-token
    """
    # TODO: Add authentication verification using token
    # For now, we'll accept all connections
    # In production, verify the token and check if user has access to this workflow

    try:
        # Accept and register the connection
        await manager.connect(websocket, workflow_id)

        # Send a connection confirmation message
        await websocket.send_json({
            "event_type": "connected",
            "workflow_id": str(workflow_id),
            "message": f"Successfully connected to workflow {workflow_id}. You will receive events for all runs of this workflow."
        })

        # Keep the connection alive and handle incoming messages
        try:
            while True:
                # Wait for any messages from the client
                # This keeps the connection alive
                data = await websocket.receive_text()

                # Optional: Handle ping/pong or other client messages
                if data == "ping":
                    await websocket.send_json({
                        "event_type": "pong",
                        "message": "Connection alive"
                    })

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for workflow {workflow_id}")

    except Exception as e:
        logger.error(
            f"WebSocket error for workflow {workflow_id}: {e}",
            extra={"workflow_id": str(workflow_id), "error": str(e)}
        )
    finally:
        # Clean up the connection
        manager.disconnect(websocket, workflow_id)


@router.get("/ws/test/{workflow_id}")
async def test_send_event(workflow_id: UUID, event_type: str = "test"):
    """
    Test endpoint to manually send a WebSocket event.
    Useful for testing WebSocket connections without running a workflow.

    Args:
        workflow_id: The workflow_id to send the test event to
        event_type: The type of event to send

    Returns:
        Success message
    """
    import uuid
    test_run_id = uuid.uuid4()

    test_message = {
        "event_type": event_type,
        "workflow_id": str(workflow_id),
        "run_id": str(test_run_id),
        "message": "This is a test event",
        "data": {"test": True}
    }

    await manager.send_to_workflow(workflow_id, test_message)

    return {
        "success": True,
        "message": f"Test event sent to workflow {workflow_id}",
        "active_connections": len(manager.active_connections.get(str(workflow_id), set()))
    }
