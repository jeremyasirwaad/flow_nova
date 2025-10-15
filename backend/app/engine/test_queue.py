"""Test script for enqueuing workflow jobs to RQ."""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.engine.engine import run_node
from app.core.queue import get_queue


if __name__ == "__main__":
    q = get_queue("node-runner")

    # Test workflow
    workflow_id = "1d8db377-36d4-4aac-a608-543efc7935ee"
    node_id = "start_node"
    user_id = "e3883bdb-59de-4050-a475-ebbc10779a63"
    input_data = {
        "message": "Starting workflow execution"
    }

    # Enqueue the job with updated signature
    job = q.enqueue(run_node, workflow_id, node_id, user_id, input_data)

    print(f"Job enqueued successfully!")
    print(f"Job ID: {job.id}")
    print(f"Queue: {job.origin}")
    print(f"\nTo process this job, run:")
    print(f"  rq worker node-runner")
    print(f"\nThis will create a new workflow run and track execution in the ledger.")
