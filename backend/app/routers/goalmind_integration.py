"""Read-only provider endpoints consumed by GoalMind's Integration Hub."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core import get_current_user
from app.models.goalmind_integration import (
    GoalMindLiteratureSearchRequest,
    GoalMindLiteratureSearchResponse,
)
from app.services.goalmind_literature_search_service import GoalMindLiteratureSearchService

router = APIRouter(prefix="/goalmind", tags=["GoalMind Integration"])


def _literature_service() -> GoalMindLiteratureSearchService:
    return GoalMindLiteratureSearchService()


@router.post(
    "/literature/search/v1",
    response_model=GoalMindLiteratureSearchResponse,
    summary="Canonical read-only literature search for GoalMind",
)
async def search_literature_for_goalmind(
    request: GoalMindLiteratureSearchRequest,
    _current_user: dict = Depends(get_current_user),
    service: GoalMindLiteratureSearchService = Depends(_literature_service),
) -> GoalMindLiteratureSearchResponse:
    """Return bounded OpenAlex evidence using the exact GoalMind semantic wire shape."""
    return await service.search(request)


__all__ = ["router"]
