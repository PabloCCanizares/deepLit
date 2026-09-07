"""Canonical read-only GoalMind literature search over DeepLit's OpenAlex provider stack.

This boundary is intentionally separate from the incremental
`deeplit-research-intelligence/v1` export. It performs no persistence, graph mutation,
collection mutation, cursor management, or GoalMind-side authority decision.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import date, datetime, timezone
from typing import Any

from pyalex import Works

from app.models.goalmind_integration import (
    GoalMindLiteratureSearchRequest,
    GoalMindLiteratureSearchResponse,
    GoalMindLiteratureWork,
)

_OPENALEX_PAGE_SIZE = 100
_DEFAULT_LIMIT = 10
_DEFAULT_OFFSET = 0


class GoalMindLiteratureSearchProviderError(RuntimeError):
    """Raised when the underlying OpenAlex response cannot satisfy the reviewed contract."""


class GoalMindLiteratureSearchService:
    """Translate the canonical GoalMind query to bounded OpenAlex reads."""

    def __init__(
        self,
        works_factory: Callable[[], Any] | None = None,
        now_provider: Callable[[], date] | None = None,
    ) -> None:
        self._works_factory = works_factory or Works
        self._now_provider = now_provider or (
            lambda: datetime.now(timezone.utc).date()
        )

    @staticmethod
    def _work_id(raw: Any) -> str:
        if not isinstance(raw, str) or not raw.strip():
            raise GoalMindLiteratureSearchProviderError("OpenAlex work has no stable id")
        work_id = raw.rstrip("/").split("/")[-1]
        if not work_id or len(work_id) > 128:
            raise GoalMindLiteratureSearchProviderError("OpenAlex work id is invalid")
        return work_id

    @staticmethod
    def _year(payload: Mapping[str, Any]) -> int | None:
        raw = payload.get("publication_year", payload.get("year"))
        if isinstance(raw, int) and not isinstance(raw, bool):
            return raw
        publication_date = payload.get("publication_date")
        if isinstance(publication_date, str) and len(publication_date) >= 4:
            prefix = publication_date[:4]
            if prefix.isdigit():
                return int(prefix)
        return None

    @staticmethod
    def _category(payload: Mapping[str, Any]) -> str | None:
        topic = payload.get("primary_topic")
        if not isinstance(topic, Mapping):
            return None
        value = topic.get("display_name")
        if not isinstance(value, str) or not value:
            return None
        return value

    @staticmethod
    def _filters(
        request: GoalMindLiteratureSearchRequest,
        *,
        today: date,
    ) -> dict[str, Any]:
        filters: dict[str, Any] = {
            "title.search": request.query,
            "to_publication_date": today.isoformat(),
        }
        if request.year_from is not None:
            filters["from_publication_date"] = f"{request.year_from:04d}-01-01"
        if request.year_to is not None:
            requested_end = date(request.year_to, 12, 31)
            filters["to_publication_date"] = min(requested_end, today).isoformat()
        return filters

    def _page(self, filters: Mapping[str, Any], page: int):
        query = self._works_factory()
        query = query.filter(**dict(filters))
        return query.get(per_page=_OPENALEX_PAGE_SIZE, page=page)

    @staticmethod
    def _total(results: Any) -> int:
        meta = getattr(results, "meta", None)
        raw = meta.get("count") if isinstance(meta, Mapping) else None
        if not isinstance(raw, int) or isinstance(raw, bool) or raw < 0:
            raise GoalMindLiteratureSearchProviderError("OpenAlex result count is invalid")
        return raw

    @classmethod
    def _normalize_work(cls, payload: Any) -> GoalMindLiteratureWork:
        if not isinstance(payload, Mapping):
            raise GoalMindLiteratureSearchProviderError("OpenAlex work is invalid")
        work_id = cls._work_id(payload.get("id"))
        title = payload.get("title") or payload.get("display_name") or ""
        if not isinstance(title, str):
            raise GoalMindLiteratureSearchProviderError("OpenAlex work title is invalid")
        return GoalMindLiteratureWork(
            source_ref=f"https://openalex.org/{work_id}",
            title=title,
            year=cls._year(payload),
            category=cls._category(payload),
        )

    async def search(
        self,
        request: GoalMindLiteratureSearchRequest,
    ) -> GoalMindLiteratureSearchResponse:
        if not isinstance(request, GoalMindLiteratureSearchRequest):
            raise TypeError("canonical GoalMind literature request required")

        today = self._now_provider()
        if not isinstance(today, date):
            raise GoalMindLiteratureSearchProviderError("provider clock is invalid")
        if request.year_from is not None and request.year_from > today.year:
            return GoalMindLiteratureSearchResponse(works=[], total=0)

        limit = request.limit if request.limit is not None else _DEFAULT_LIMIT
        offset = request.offset if request.offset is not None else _DEFAULT_OFFSET
        filters = self._filters(request, today=today)

        first_page = (offset // _OPENALEX_PAGE_SIZE) + 1
        first_index = offset % _OPENALEX_PAGE_SIZE
        first_results = self._page(filters, first_page)
        total = self._total(first_results)
        first_items = list(first_results)
        selected = first_items[first_index : first_index + limit]

        remaining = limit - len(selected)
        if remaining > 0 and offset + len(selected) < total:
            second_results = self._page(filters, first_page + 1)
            second_total = self._total(second_results)
            if second_total != total:
                raise GoalMindLiteratureSearchProviderError(
                    "OpenAlex result count changed during bounded pagination"
                )
            selected.extend(list(second_results)[:remaining])

        works = [self._normalize_work(item) for item in selected]
        return GoalMindLiteratureSearchResponse(works=works, total=total)


__all__ = [
    "GoalMindLiteratureSearchProviderError",
    "GoalMindLiteratureSearchService",
]
