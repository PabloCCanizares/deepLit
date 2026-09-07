from __future__ import annotations

import unittest
from datetime import date
from typing import Any

from pydantic import ValidationError

from app.models.goalmind_integration import GoalMindLiteratureSearchRequest
from app.services.goalmind_literature_search_service import (
    GoalMindLiteratureSearchProviderError,
    GoalMindLiteratureSearchService,
)


class FakeResults(list):
    def __init__(self, values: list[dict[str, Any]], total: int) -> None:
        super().__init__(values)
        self.meta = {"count": total}


class FakeWorksQuery:
    def __init__(
        self,
        *,
        pages: dict[int, list[dict[str, Any]]],
        total: int,
        calls: list[dict[str, Any]],
        totals_by_page: dict[int, int] | None = None,
    ) -> None:
        self.pages = pages
        self.total = total
        self.calls = calls
        self.totals_by_page = totals_by_page or {}
        self.filters: dict[str, Any] = {}

    def filter(self, **filters: Any) -> "FakeWorksQuery":
        self.filters = dict(filters)
        return self

    def get(self, *, per_page: int, page: int) -> FakeResults:
        self.calls.append(
            {
                "filters": dict(self.filters),
                "per_page": per_page,
                "page": page,
            }
        )
        return FakeResults(
            list(self.pages.get(page, [])),
            self.totals_by_page.get(page, self.total),
        )


class FakeWorksFactory:
    def __init__(
        self,
        *,
        pages: dict[int, list[dict[str, Any]]],
        total: int,
        totals_by_page: dict[int, int] | None = None,
    ) -> None:
        self.pages = pages
        self.total = total
        self.totals_by_page = totals_by_page
        self.calls: list[dict[str, Any]] = []

    def __call__(self) -> FakeWorksQuery:
        return FakeWorksQuery(
            pages=self.pages,
            total=self.total,
            calls=self.calls,
            totals_by_page=self.totals_by_page,
        )


def _work(index: int, *, year: Any = 2026, category: Any = "Computer Science") -> dict[str, Any]:
    return {
        "id": f"https://openalex.org/W{index}",
        "display_name": f"Work {index}",
        "publication_year": year,
        "primary_topic": {"display_name": category} if category is not None else None,
    }


class GoalMindLiteratureSearchProviderTests(unittest.IsolatedAsyncioTestCase):
    def test_request_contract_is_strict_and_rejects_reversed_year_range(self) -> None:
        with self.assertRaises(ValidationError):
            GoalMindLiteratureSearchRequest(query="cloud", unexpected=True)
        with self.assertRaises(ValidationError):
            GoalMindLiteratureSearchRequest(query="cloud", year_from=2025, year_to=2024)
        with self.assertRaises(ValidationError):
            GoalMindLiteratureSearchRequest(query="cloud", limit=101)
        with self.assertRaises(ValidationError):
            GoalMindLiteratureSearchRequest(query="cloud", offset=-1)

    async def test_default_query_maps_to_bounded_openalex_and_normalizes_output(self) -> None:
        factory = FakeWorksFactory(
            pages={1: [_work(1), _work(2, year="unknown", category=None)]},
            total=2,
        )
        service = GoalMindLiteratureSearchService(
            factory,
            now_provider=lambda: date(2026, 9, 7),
        )

        response = await service.search(GoalMindLiteratureSearchRequest(query="surrogate cloud"))

        self.assertEqual(len(factory.calls), 1)
        self.assertEqual(
            factory.calls[0],
            {
                "filters": {
                    "title.search": "surrogate cloud",
                    "to_publication_date": "2026-09-07",
                },
                "per_page": 100,
                "page": 1,
            },
        )
        self.assertEqual(
            response.model_dump(),
            {
                "works": [
                    {
                        "source_ref": "https://openalex.org/W1",
                        "title": "Work 1",
                        "year": 2026,
                        "category": "Computer Science",
                    },
                    {
                        "source_ref": "https://openalex.org/W2",
                        "title": "Work 2",
                        "year": None,
                        "category": None,
                    },
                ],
                "total": 2,
            },
        )

    async def test_year_bounds_translate_to_dates_and_future_upper_bound_is_capped(self) -> None:
        factory = FakeWorksFactory(pages={1: []}, total=0)
        service = GoalMindLiteratureSearchService(
            factory,
            now_provider=lambda: date(2026, 9, 7),
        )
        await service.search(
            GoalMindLiteratureSearchRequest(
                query="fog",
                year_from=2020,
                year_to=2024,
            )
        )
        self.assertEqual(
            factory.calls[0]["filters"],
            {
                "title.search": "fog",
                "from_publication_date": "2020-01-01",
                "to_publication_date": "2024-12-31",
            },
        )

        future_factory = FakeWorksFactory(pages={1: []}, total=0)
        future_service = GoalMindLiteratureSearchService(
            future_factory,
            now_provider=lambda: date(2026, 9, 7),
        )
        await future_service.search(
            GoalMindLiteratureSearchRequest(query="fog", year_to=2030)
        )
        self.assertEqual(
            future_factory.calls[0]["filters"]["to_publication_date"],
            "2026-09-07",
        )

    async def test_arbitrary_offset_crosses_one_internal_page_exactly(self) -> None:
        factory = FakeWorksFactory(
            pages={
                1: [_work(i) for i in range(100)],
                2: [_work(i) for i in range(100, 200)],
            },
            total=250,
        )
        service = GoalMindLiteratureSearchService(
            factory,
            now_provider=lambda: date(2026, 9, 7),
        )

        response = await service.search(
            GoalMindLiteratureSearchRequest(query="graph", offset=95, limit=10)
        )

        self.assertEqual([call["page"] for call in factory.calls], [1, 2])
        self.assertEqual(
            [work.source_ref for work in response.works],
            [f"https://openalex.org/W{i}" for i in range(95, 105)],
        )
        self.assertEqual(response.total, 250)

    async def test_future_lower_bound_short_circuits_without_external_call(self) -> None:
        factory = FakeWorksFactory(pages={}, total=0)
        service = GoalMindLiteratureSearchService(
            factory,
            now_provider=lambda: date(2026, 9, 7),
        )
        response = await service.search(
            GoalMindLiteratureSearchRequest(query="future", year_from=2030)
        )
        self.assertEqual(response.model_dump(), {"works": [], "total": 0})
        self.assertEqual(factory.calls, [])

    async def test_cross_page_total_drift_fails_closed(self) -> None:
        factory = FakeWorksFactory(
            pages={
                1: [_work(i) for i in range(100)],
                2: [_work(i) for i in range(100, 200)],
            },
            total=250,
            totals_by_page={2: 251},
        )
        service = GoalMindLiteratureSearchService(
            factory,
            now_provider=lambda: date(2026, 9, 7),
        )
        with self.assertRaisesRegex(
            GoalMindLiteratureSearchProviderError,
            "count changed",
        ):
            await service.search(
                GoalMindLiteratureSearchRequest(query="graph", offset=95, limit=10)
            )

    async def test_malformed_openalex_identity_and_count_fail_closed(self) -> None:
        bad_count_factory = FakeWorksFactory(pages={1: []}, total=-1)
        bad_count_service = GoalMindLiteratureSearchService(
            bad_count_factory,
            now_provider=lambda: date(2026, 9, 7),
        )
        with self.assertRaisesRegex(GoalMindLiteratureSearchProviderError, "count"):
            await bad_count_service.search(GoalMindLiteratureSearchRequest(query="graph"))

        bad_work_factory = FakeWorksFactory(
            pages={1: [{"id": None, "display_name": "Missing ID"}]},
            total=1,
        )
        bad_work_service = GoalMindLiteratureSearchService(
            bad_work_factory,
            now_provider=lambda: date(2026, 9, 7),
        )
        with self.assertRaisesRegex(GoalMindLiteratureSearchProviderError, "stable id"):
            await bad_work_service.search(GoalMindLiteratureSearchRequest(query="graph"))


if __name__ == "__main__":
    unittest.main()
