"""Routes related to agent-adjacent functionality."""

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from app.core.config import settings
from app.models.user import User
from app.routes.auth import get_current_active_user

router = APIRouter()


@router.get("/agents/models")
async def get_agent_models(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Return the list of available agent models by proxying the model service."""
    models_endpoint = settings.models_service_url
    headers: dict[str, str] = {}
    if settings.models_service_api_key:
        headers["Authorization"] = f"Bearer {settings.models_service_api_key}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                models_endpoint,
                timeout=10.0,
                headers=headers,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Model service returned HTTP {status} for GET {url}",
            status=exc.response.status_code,
            url=models_endpoint,
        )
        raise HTTPException(
            status_code=exc.response.status_code,
            detail="Failed to fetch models from model service",
        ) from exc
    except httpx.RequestError as exc:
        logger.error("Error connecting to model service: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error connecting to model service",
        ) from exc

    return response.json()
