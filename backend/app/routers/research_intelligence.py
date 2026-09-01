"""Authenticated read-only Research Intelligence export surface."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.services.research_intelligence_export_service import (
    MAX_EVENTS,
    SCHEMA_VERSION,
    ResearchIntelligenceCursorError,
    ResearchIntelligenceExportService,
)

router = APIRouter(prefix="/research-intelligence", tags=["Research Intelligence"])


@router.get("/delta")
async def get_research_intelligence_delta(
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=MAX_EVENTS),
    schema_version: str = Query(default=SCHEMA_VERSION),
    current_user: dict = Depends(get_current_user),
):
    """Return one deterministic delta page for the authenticated user only."""
    user_id = current_user.get("_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Usuario autenticado sin identidad estable.")
    try:
        return await ResearchIntelligenceExportService().export_page(
            user_id=str(user_id),
            cursor=cursor,
            limit=limit,
            schema_version=schema_version,
        )
    except ResearchIntelligenceCursorError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/contract")
async def get_research_intelligence_contract(
    current_user: dict = Depends(get_current_user),
):
    """Expose bounded contract metadata without accepting caller-supplied tenant IDs."""
    if current_user.get("_id") is None:
        raise HTTPException(status_code=401, detail="Usuario autenticado sin identidad estable.")
    return {
        "schema_version": SCHEMA_VERSION,
        "provider": "deeplit",
        "max_events": MAX_EVENTS,
        "operations": ["upsert", "correction", "retraction"],
        "object_kinds": ["work"],
        "cursor_scope": "authenticated_user",
        "mutable_legacy_rows_are_authority": False,
    }


__all__ = ["router"]
