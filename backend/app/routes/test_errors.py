"""Test endpoints for demonstrating error logging."""

from fastapi import APIRouter, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field

router = APIRouter()


class TestInput(BaseModel):
    """Test input model for validation."""
    name: str = Field(..., min_length=3, max_length=50)
    age: int = Field(..., gt=0, lt=150)


@router.get("/test/error-manual")
async def test_manual_error():
    """
    Manually logged error - you control when/what to log.
    This shows how to log errors in try/catch blocks.
    """
    try:
        # Simulate some operation that fails
        result = 10 / 0
    except ZeroDivisionError as e:
        # Manually log the error with context
        logger.error(
            f"Division by zero error in test endpoint",
            extra={
                "operation": "division",
                "error_type": "ZeroDivisionError",
            }
        )
        # Still raise the exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Division by zero"
        )


@router.get("/test/error-crash")
async def test_crash():
    """
    Uncaught exception - automatically logged by global exception handler.
    This simulates a crash/unhandled error.
    """
    # This will be caught by the global exception handler in main.py
    # and automatically logged to Loki with full stack trace
    raise ValueError("This is an intentional crash for testing!")


@router.get("/test/error-404")
async def test_404():
    """
    HTTP 404 error - logged by HTTP exception handler.
    """
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Resource not found"
    )


@router.post("/test/error-validation")
async def test_validation_error(data: TestInput):
    """
    Validation error (422) - logged by validation exception handler.
    Try sending: {"name": "ab", "age": -5}
    """
    logger.info(f"Received valid data: {data}")
    return {"message": "Valid data received", "data": data}


@router.get("/test/error-database")
async def test_database_error():
    """
    Simulate a database error.
    """
    try:
        # Simulate database operation failure
        from sqlalchemy import text
        from app.core.database import async_engine

        async with async_engine.connect() as conn:
            # This will fail
            await conn.execute(text("SELECT * FROM non_existent_table"))

    except Exception as e:
        logger.exception(
            "Database operation failed",
            extra={
                "operation": "select",
                "table": "non_existent_table",
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )


@router.get("/test/error-multiple")
async def test_multiple_errors():
    """
    Test logging multiple errors at different levels.
    """
    logger.debug("Starting multiple error test")
    logger.info("This is an informational message")
    logger.warning("This is a warning - something might be wrong")
    logger.error("This is an error - something went wrong")

    # Try-except with logging
    try:
        data = {"user": "test"}
        value = data["missing_key"]  # KeyError
    except KeyError as e:
        logger.exception(f"KeyError occurred: {e}")

    # Another error
    try:
        items = [1, 2, 3]
        item = items[10]  # IndexError
    except IndexError as e:
        logger.error(f"IndexError: {e}", extra={"list_length": len(items), "index": 10})

    return {"message": "Check logs for multiple error examples"}


@router.get("/test/success")
async def test_success():
    """
    Successful operation - only info logs.
    """
    logger.info("Processing successful request")
    logger.debug("Debug info: operation completed successfully")
    return {"status": "success", "message": "No errors here!"}
