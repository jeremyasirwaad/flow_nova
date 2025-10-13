"""Example background tasks for RQ."""

import time
from typing import Dict, Any

from loguru import logger

from app.core.database import get_sync_db
from app.models.task import Task, TaskStatus


def process_long_task(task_id: int, duration: int = 10) -> Dict[str, Any]:
    """
    Example long-running task.

    Args:
        task_id: The task ID to process
        duration: How long to simulate processing (seconds)

    Returns:
        Dictionary with task result
    """
    logger.info(f"Starting task {task_id}, duration: {duration}s")

    db = get_sync_db()

    try:
        # Update task status to processing
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            task.status = TaskStatus.PROCESSING
            db.commit()

        # Simulate long-running work
        for i in range(duration):
            time.sleep(1)
            logger.info(f"Task {task_id}: {i + 1}/{duration} seconds elapsed")

        # Update task status to completed
        if task:
            task.status = TaskStatus.COMPLETED
            db.commit()

        result = {
            "task_id": task_id,
            "status": "completed",
            "duration": duration,
            "message": f"Task {task_id} completed successfully",
        }

        logger.info(f"Task {task_id} completed successfully")
        return result

    except Exception as e:
        logger.error(f"Task {task_id} failed: {str(e)}")

        # Update task status to failed
        if task:
            task.status = TaskStatus.FAILED
            db.commit()

        raise

    finally:
        db.close()


def send_email_task(to: str, subject: str, body: str) -> Dict[str, Any]:
    """
    Example email sending task.

    Args:
        to: Recipient email
        subject: Email subject
        body: Email body

    Returns:
        Dictionary with result
    """
    logger.info(f"Sending email to {to}: {subject}")

    # Simulate email sending
    time.sleep(2)

    logger.info(f"Email sent to {to}")

    return {
        "status": "sent",
        "to": to,
        "subject": subject,
    }
