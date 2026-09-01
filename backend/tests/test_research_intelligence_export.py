from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "services"
    / "research_intelligence_export_service.py"
)
SPEC = importlib.util.spec_from_file_location(
    "research_intelligence_export_service_under_test", MODULE_PATH
)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import bootstrap guard.
    raise RuntimeError("No se pudo cargar el provider para tests.")
PROVIDER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PROVIDER
SPEC.loader.exec_module(PROVIDER)

SCHEMA_VERSION = PROVIDER.SCHEMA_VERSION
ResearchIntelligenceCursorError = PROVIDER.ResearchIntelligenceCursorError
ResearchIntelligenceExportService = PROVIDER.ResearchIntelligenceExportService
_encode_cursor = PROVIDER._encode_cursor

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

    async def latest_events(self, user_id: str, object_kind: str) -> list[dict[str, Any]]:
        source_ids = sorted(
            {
                str(row["source_object_id"])
                for row in self.rows
                if row["id_user"] == user_id and row["object_kind"] == object_kind
            }
        )
        result: list[dict[str, Any]] = []
        for source_id in source_ids:
            latest = await self.latest_event(user_id, object_kind, source_id)
            if latest is not None:
                result.append(latest)
        return result

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


class InMemoryLibraryReader:
    def __init__(self) -> None:
        self.visible: dict[str, dict[str, dict[str, Any]]] = {}

    def set_visible(self, user_id: str, *works: dict[str, Any]) -> None:
        self.visible[user_id] = {
            str(work["_id"]): dict(work) for work in works if work.get("_id") is not None
        }

    async def get_visible_work(
        self, user_id: str, source_object_id: str
    ) -> dict[str, Any] | None:
        work = self.visible.get(user_id, {}).get(source_object_id)
        return dict(work) if work is not None else None

    async def visible_works(self, user_id: str) -> list[dict[str, Any]]:
        values = self.visible.get(user_id, {})
        return [dict(values[key]) for key in sorted(values)]


class ResearchIntelligenceExportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.ledger = InMemoryLedger()
        self.library = InMemoryLibraryReader()
        self.service = ResearchIntelligenceExportService(self.ledger, self.library)
        self.work = {
            "_id": "W123",
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
            user_id="user-a", source_object_id="W123", payload=self.work, observed_at=NOW
        )
        b = await self.service.record_work(
            user_id="user-b", source_object_id="W123", payload=self.work, observed_at=NOW
        )
        self.assertNotEqual(a["object_id"], b["object_id"])
        self.assertEqual(a["object_version"], b["object_version"])

        page_a = await self.service.export_page(user_id="user-a")
        page_b = await self.service.export_page(user_id="user-b")
        self.assertNotEqual(page_a["cursor_after"], page_b["cursor_after"])
        self.assertEqual(page_a["generated_at"], a["retrieved_at"])
        self.assertEqual(page_b["generated_at"], b["retrieved_at"])

        await self.service.retract_work(
            user_id="user-a", source_object_id="W123", observed_at=NOW + timedelta(seconds=1)
        )
        latest_b = await self.ledger.latest_event("user-b", "work", "W123")
        self.assertIsNotNone(latest_b)
        self.assertEqual(latest_b["operation"], "upsert")

    async def test_tenant_visibility_controls_capture_and_unsave_tombstone(self) -> None:
        self.library.set_visible("user-a", self.work)
        self.library.set_visible("user-b", self.work)
        a = await self.service.capture_article(
            user_id="user-a", source_object_id="W123", observed_at=NOW
        )
        b = await self.service.capture_article(
            user_id="user-b", source_object_id="W123", observed_at=NOW
        )
        self.assertNotEqual(a["object_id"], b["object_id"])

        self.library.set_visible("user-a")
        retracted_a = await self.service.capture_or_retract_article(
            user_id="user-a",
            source_object_id="W123",
            observed_at=NOW + timedelta(minutes=1),
        )
        self.assertIsNotNone(retracted_a)
        self.assertEqual(retracted_a["operation"], "retraction")
        latest_b = await self.ledger.latest_event("user-b", "work", "W123")
        self.assertEqual(latest_b["operation"], "upsert")

    async def test_duplicate_capture_is_idempotent_and_replay_is_deterministic(self) -> None:
        first = await self.service.record_work(
            user_id="user-a", source_object_id="W123", payload=self.work, observed_at=NOW
        )
        duplicate = await self.service.record_work(
            user_id="user-a",
            source_object_id="W123",
            payload=dict(self.work),
            observed_at=NOW + timedelta(minutes=5),
        )
        self.assertEqual(first, duplicate)
        self.assertEqual(len(self.ledger.rows), 1)

        page_one = await self.service.export_page(user_id="user-a")
        page_two = await self.service.export_page(user_id="user-a")
        self.assertEqual(page_one, page_two)
        self.assertEqual(
            json.dumps(page_one, sort_keys=True, separators=(",", ":")),
            json.dumps(page_two, sort_keys=True, separators=(",", ":")),
        )

    async def test_correction_and_retraction_preserve_predecessor_lineage(self) -> None:
        first = await self.service.record_work(
            user_id="user-a", source_object_id="W123", payload=self.work, observed_at=NOW
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

    async def test_reconciliation_repairs_missing_upsert_and_missing_tombstone(self) -> None:
        self.library.set_visible("user-a", self.work)
        first = await self.service.reconcile_user_library(user_id="user-a", observed_at=NOW)
        self.assertEqual(
            first,
            {"upserts": 1, "corrections": 0, "unchanged": 0, "retractions": 0},
        )
        second = await self.service.reconcile_user_library(
            user_id="user-a", observed_at=NOW + timedelta(minutes=1)
        )
        self.assertEqual(second["unchanged"], 1)
        self.assertEqual(len(self.ledger.rows), 1)

        self.library.set_visible("user-a")
        third = await self.service.reconcile_user_library(
            user_id="user-a", observed_at=NOW + timedelta(minutes=2)
        )
        self.assertEqual(third["retractions"], 1)
        latest = await self.ledger.latest_event("user-a", "work", "W123")
        self.assertEqual(latest["operation"], "retraction")

    async def test_cross_tenant_and_future_cursors_fail_closed(self) -> None:
        await self.service.record_work(
            user_id="user-a", source_object_id="W123", payload=self.work, observed_at=NOW
        )
        page = await self.service.export_page(user_id="user-a")
        with self.assertRaises(ResearchIntelligenceCursorError):
            await self.service.export_page(user_id="user-b", cursor=page["cursor_after"])
        with self.assertRaises(ResearchIntelligenceCursorError):
            await self.service.export_page(
                user_id="user-a", cursor=_encode_cursor("user-a", 999)
            )
        with self.assertRaises(ResearchIntelligenceCursorError):
            await self.service.export_page(user_id="user-a", cursor="not-a-cursor")

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
            user_id="user-a", source_object_id="W123", payload=payload, observed_at=NOW
        )
        encoded = json.dumps(await self.service.export_page(user_id="user-a"), sort_keys=True)
        for forbidden in (
            "chain-of-thought",
            "SECRET",
            "file:///private",
            "private-collection",
            "legacy-owner",
            "pdf_url",
            "abstract",
        ):
            self.assertNotIn(forbidden, encoded)

    async def test_retraction_without_previous_authority_is_noop(self) -> None:
        result = await self.service.retract_work(
            user_id="user-a", source_object_id="W-missing", observed_at=NOW
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
