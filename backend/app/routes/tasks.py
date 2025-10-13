"""Task management endpoints."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.queue import get_queue
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse
from app.workers.example_tasks import process_long_task

router = APIRouter()


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new task and queue it for processing.
    """
    # Create task in database
    task = Task(
        title=task_data.title,
        description=task_data.description,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Queue the task for background processing
    queue = get_queue("default")
    job = queue.enqueue(
        process_long_task,
        task_id=task.id,
        duration=10,  # 10 second task
        job_timeout="5m",
    )

    # Update task with job ID
    task.job_id = job.id
    await db.commit()
    await db.refresh(task)

    return task


@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """
    List all tasks with pagination.
    """
    result = await db.execute(
        select(Task).offset(skip).limit(limit).order_by(Task.created_at.desc())
    )
    tasks = result.scalars().all()
    return tasks


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific task by ID.
    """
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )

    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a task by ID.
    """
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found",
        )

    await db.delete(task)
    await db.commit()
