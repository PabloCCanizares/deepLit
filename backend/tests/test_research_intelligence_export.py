from __future__ import annotations

import json
import unittest
from datetime import UTC, datetime, timedelta
from typing import Any

from app.services.research_intelligence_export_service import (
    SCHEMA_VERSION,
    ResearchIntelligenceCursorError,
    ResearchIntelligenceExportService,
    _encode_cursor,
)

NOW = datetime(2026, 9, 1, 12, 0, tzinfo=UTC)


class InMemoryLedger:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []
        self.counters: dict[str, int] = {}

    async def ensure_indexes(self) -> None:
        return None

    async def next_sequence(self, user_id: str) -> int:
        self.counters[user_id] = self.counters.get(user_id, 0) + 1
        return self.counters[user_id]

    async def max_sequence(self, user_id: str) -> int:
        values = [int(row["sequence"]) for row in self.rows if row["id_user"] == user_id]
        return max(values, default=0)

    async def latest_event(
        self, user_id: str, object_kind: str, source_object_id: str
    ) -> dict[str, Any] | None:
        matches = [
            row
            for row in self.rows
            if row["id_user"] == user_id
            and row["object_kind"] == object_kind
            and row["source_object_id"] == source_object_id
        ]
        if not matches:
            return None
        return max(matches, key=lambda row: int(row["lineage_depth"]))

    async def append_event(self, event: dict[str, Any]) -> bool:
        identity = (
            event["id_user"],
            event["object_kind"],
            event["source_object_id"],
            event["lineage_depth"],
        )
        if any(
            (
                row["id_user"],
                row["object_kind"],
                row["source_object_id"],
                row["lineage_depth"],
            )
            == identity
            for row in self.rows
        ):
            return False
        if any(
            row["id_user"] == event["id_user"]
            and row["sequence"] == event["sequence"]
            for row in self.rows
        ):
            return False
        self.rows.append(dict(event))
        return True

    async def events_after(
        self, user_id: str, after_sequence: int, limit: int
    ) -> list[dict[str, Any]]:
        rows = [
            row
            for row in self.rows
            if row["id_user"] == user_id and int(row["sequence"]) > after_sequence
        ]
        rows.sort(key=lambda row: (int(row["sequence"]), str(row["_id"])))
        return [dict(row) for row in rows[:limit]]


class ResearchIntelligenceExportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.ledger = InMemoryLedger()
        self.service = ResearchIntelligenceExportService(self.ledger)
        self.work = {
            "title": "Trustworthy Surrogate Optimization",
            "doi": "10.1000/example",
            "year": 2026,
            "authors": ["Ada Example", "Grace Example"],
            "keywords": [
                {"key": "surrogate models", "score": 0.9},
                {"key": "cloud", "score": 0.8},
            ],
            "citations": 12,
        }

    async def test_same_work_two_users_has_independent_identity_history_and_cursor(self) -> None:
        a = await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=self.work,
            observed_at=NOW,
        )
        b = await self.service.record_work(
            user_id="user-b",
            source_object_id="W123",
            payload=self.work,
            observed_at=NOW,
        )

        self.assertNotEqual(a["object_id"], b["object_id"])
        self.assertEqual(a["object_version"], b["object_version"])

        page_a = await self.service.export_page(
            user_id="user-a", generated_at=NOW + timedelta(seconds=1)
        )
        page_b = await self.service.export_page(
            user_id="user-b", generated_at=NOW + timedelta(seconds=1)
        )
        self.assertNotEqual(page_a["cursor_after"], page_b["cursor_after"])
        self.assertEqual([event["object_id"] for event in page_a["events"]], [a["object_id"]])
        self.assertEqual([event["object_id"] for event in page_b["events"]], [b["object_id"]])

        retracted = await self.service.retract_work(
            user_id="user-a",
            source_object_id="W123",
            observed_at=NOW + timedelta(seconds=2),
        )
        self.assertIsNotNone(retracted)
        self.assertEqual(retracted["operation"], "retraction")

        latest_b = await self.ledger.latest_event("user-b", "work", "W123")
        self.assertIsNotNone(latest_b)
        self.assertEqual(latest_b["operation"], "upsert")
        self.assertEqual(latest_b["object_version"], b["object_version"])

    async def test_duplicate_capture_is_idempotent_and_replay_is_deterministic(self) -> None:
        first = await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=self.work,
            observed_at=NOW,
        )
        duplicate = await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=dict(self.work),
            observed_at=NOW + timedelta(minutes=5),
        )
        self.assertEqual(first, duplicate)
        self.assertEqual(len(self.ledger.rows), 1)

        page_one = await self.service.export_page(user_id="user-a", generated_at=NOW)
        page_two = await self.service.export_page(user_id="user-a", generated_at=NOW)
        self.assertEqual(page_one, page_two)
        self.assertEqual(
            json.dumps(page_one, sort_keys=True, separators=(",", ":")),
            json.dumps(page_two, sort_keys=True, separators=(",", ":")),
        )

    async def test_correction_and_retraction_preserve_predecessor_lineage(self) -> None:
        first = await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=self.work,
            observed_at=NOW,
        )
        changed = dict(self.work)
        changed["citations"] = 13
        correction = await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=changed,
            observed_at=NOW + timedelta(hours=1),
        )
        retraction = await self.service.retract_work(
            user_id="user-a",
            source_object_id="W123",
            reason_code="user_removed",
            observed_at=NOW + timedelta(hours=2),
        )

        self.assertEqual(first["operation"], "upsert")
        self.assertEqual(correction["operation"], "correction")
        self.assertEqual(correction["supersedes_version"], first["object_version"])
        self.assertIsNotNone(retraction)
        self.assertEqual(retraction["operation"], "retraction")
        self.assertEqual(retraction["supersedes_version"], correction["object_version"])
        self.assertEqual(retraction["signals"], {})

        page = await self.service.export_page(user_id="user-a", generated_at=NOW)
        self.assertEqual(
            [event["operation"] for event in page["events"]],
            ["upsert", "correction", "retraction"],
        )

    async def test_cross_tenant_and_future_cursors_fail_closed(self) -> None:
        await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=self.work,
            observed_at=NOW,
        )
        page = await self.service.export_page(user_id="user-a", generated_at=NOW)

        with self.assertRaises(ResearchIntelligenceCursorError):
            await self.service.export_page(
                user_id="user-b",
                cursor=page["cursor_after"],
                generated_at=NOW,
            )

        with self.assertRaises(ResearchIntelligenceCursorError):
            await self.service.export_page(
                user_id="user-a",
                cursor=_encode_cursor("user-a", 999),
                generated_at=NOW,
            )

        with self.assertRaises(ResearchIntelligenceCursorError):
            await self.service.export_page(
                user_id="user-a",
                cursor="not-a-cursor",
                generated_at=NOW,
            )

    async def test_export_is_bounded_and_excludes_sensitive_or_internal_fields(self) -> None:
        payload = {
            **self.work,
            "abstract": "chain-of-thought SECRET=should-not-leave-provider",
            "pdf_url": "file:///private/storage/token=secret.pdf",
            "landing_page_url": "https://example.invalid/private?token=secret",
            "collection_ids": ["private-collection"],
            "id_user": "legacy-owner",
            "error_message": "SECRET diagnostic",
        }
        await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=payload,
            observed_at=NOW,
        )
        page = await self.service.export_page(user_id="user-a", generated_at=NOW)
        encoded = json.dumps(page, sort_keys=True)

        self.assertNotIn("chain-of-thought", encoded)
        self.assertNotIn("SECRET", encoded)
        self.assertNotIn("file:///private", encoded)
        self.assertNotIn("private-collection", encoded)
        self.assertNotIn("legacy-owner", encoded)
        self.assertNotIn("pdf_url", encoded)
        self.assertNotIn("abstract", encoded)
        self.assertEqual(page["events"][0]["signals"]["article_id"], "W123")

    async def test_retraction_without_previous_authority_is_noop(self) -> None:
        result = await self.service.retract_work(
            user_id="user-a",
            source_object_id="W-missing",
            observed_at=NOW,
        )
        self.assertIsNone(result)
        self.assertEqual(self.ledger.rows, [])

    async def test_schema_and_page_limits_fail_closed(self) -> None:
        with self.assertRaises(ValueError):
            await self.service.export_page(
                user_id="user-a", schema_version="deeplit-research-intelligence/v999"
            )
        for invalid in (0, -1, 501, True):
            with self.assertRaises(ValueError):
                await self.service.export_page(user_id="user-a", limit=invalid)  # type: ignore[arg-type]
        self.assertEqual(SCHEMA_VERSION, "deeplit-research-intelligence/v1")


if __name__ == "__main__":
    unittest.main()
