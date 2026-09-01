"""Versioned, tenant-scoped Research Intelligence export for GoalMind.

The export ledger is deliberately independent from mutable legacy scientific rows.
Authenticated user identity is supplied by the caller boundary and is never accepted
from exported payloads.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
from datetime import UTC, datetime
from typing import Any, Protocol

from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.database import get_database

SCHEMA_VERSION = "deeplit-research-intelligence/v1"
PROVIDER_ID = "deeplit"
MAX_EVENTS = 500
MAX_SOURCE_REFS = 32
MAX_LIST_VALUES = 64
MAX_CURSOR_LENGTH = 1000
MAX_TEXT = 4000
_SAFE_CODE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")


class ResearchIntelligenceCursorError(ValueError):
    """Raised when a provider cursor cannot safely be replayed for this tenant."""


class ResearchIntelligenceLedger(Protocol):
    async def ensure_indexes(self) -> None: ...
    async def next_sequence(self, user_id: str) -> int: ...
    async def max_sequence(self, user_id: str) -> int: ...
    async def latest_event(
        self, user_id: str, object_kind: str, source_object_id: str
    ) -> dict[str, Any] | None: ...
    async def append_event(self, event: dict[str, Any]) -> bool: ...
    async def events_after(
        self, user_id: str, after_sequence: int, limit: int
    ) -> list[dict[str, Any]]: ...


class MongoResearchIntelligenceLedger:
    """Mongo-backed append-only provider authority."""

    def __init__(self, database: Any | None = None) -> None:
        db = database if database is not None else get_database()
        self.events = db.research_intelligence_events
        self.counters = db.research_intelligence_counters
        self._indexes_ready = False

    async def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        await self.events.create_index(
            [("id_user", ASCENDING), ("sequence", ASCENDING)],
            unique=True,
            name="uq_research_intel_tenant_sequence",
        )
        await self.events.create_index(
            [
                ("id_user", ASCENDING),
                ("object_kind", ASCENDING),
                ("source_object_id", ASCENDING),
                ("lineage_depth", ASCENDING),
            ],
            unique=True,
            name="uq_research_intel_tenant_object_depth",
        )
        await self.events.create_index(
            [
                ("id_user", ASCENDING),
                ("object_kind", ASCENDING),
                ("source_object_id", ASCENDING),
                ("lineage_depth", DESCENDING),
            ],
            name="ix_research_intel_latest",
        )
        self._indexes_ready = True

    async def next_sequence(self, user_id: str) -> int:
        row = await self.counters.find_one_and_update(
            {"_id": f"research-intel:{user_id}", "id_user": user_id},
            {"$inc": {"sequence": 1}, "$setOnInsert": {"id_user": user_id}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if not row:
            raise RuntimeError("No se pudo reservar la secuencia de Research Intelligence.")
        return int(row["sequence"])

    async def max_sequence(self, user_id: str) -> int:
        row = await self.events.find_one(
            {"id_user": user_id},
            projection={"sequence": 1},
            sort=[("sequence", DESCENDING)],
        )
        return int(row["sequence"]) if row else 0

    async def latest_event(
        self, user_id: str, object_kind: str, source_object_id: str
    ) -> dict[str, Any] | None:
        return await self.events.find_one(
            {
                "id_user": user_id,
                "object_kind": object_kind,
                "source_object_id": source_object_id,
            },
            sort=[("lineage_depth", DESCENDING)],
        )

    async def append_event(self, event: dict[str, Any]) -> bool:
        try:
            await self.events.insert_one(event)
            return True
        except DuplicateKeyError:
            return False

    async def events_after(
        self, user_id: str, after_sequence: int, limit: int
    ) -> list[dict[str, Any]]:
        cursor = self.events.find(
            {"id_user": user_id, "sequence": {"$gt": after_sequence}}
        ).sort([("sequence", ASCENDING), ("_id", ASCENDING)]).limit(limit)
        return await cursor.to_list(length=limit)


class ResearchIntelligenceExportService:
    """Producer-owned immutable delta stream for one authenticated tenant."""

    def __init__(self, ledger: ResearchIntelligenceLedger | None = None) -> None:
        self.ledger = ledger or MongoResearchIntelligenceLedger()

    async def record_work(
        self,
        *,
        user_id: str,
        source_object_id: str,
        payload: dict[str, Any],
        source: str = "openalex",
        observed_at: datetime | None = None,
    ) -> dict[str, Any]:
        user = _required_token(user_id, "user_id", 300)
        source_id = _required_token(source_object_id, "source_object_id", 500)
        clean_source = _required_token(source, "source", 80).casefold()
        signals, source_refs = _work_projection(source_id, payload, clean_source)
        fingerprint = _fingerprint({"signals": signals, "source_refs": source_refs})
        return await self._append_change(
            user_id=user,
            object_kind="work",
            source_object_id=source_id,
            fingerprint=fingerprint,
            signals=signals,
            source_refs=source_refs,
            retraction=False,
            reason_code=None,
            observed_at=observed_at,
        )

    async def capture_article(
        self,
        *,
        user_id: str,
        source_object_id: str,
        observed_at: datetime | None = None,
    ) -> dict[str, Any]:
        """Snapshot a scientific work after an authenticated user save/update action.

        Legacy article rows may use a global scientific `_id`; ownership of this export
        event comes exclusively from the authenticated `user_id`, and tenant-specific
        fields such as collection membership are deliberately not projected.
        """
        from app.repositories import ArticleRepository

        article = await ArticleRepository().find_by_id(source_object_id)
        if article is None:
            raise ValueError("Articulo cientifico no encontrado para exportacion.")
        return await self.record_work(
            user_id=user_id,
            source_object_id=source_object_id,
            payload=article,
            source="openalex" if str(source_object_id).startswith("W") else "deeplit",
            observed_at=observed_at,
        )

    async def capture_or_retract_article(
        self,
        *,
        user_id: str,
        source_object_id: str,
        observed_at: datetime | None = None,
    ) -> dict[str, Any] | None:
        """Refresh a work after an authenticated removal action or emit a tombstone."""
        from app.repositories import ArticleRepository

        article = await ArticleRepository().find_by_id(source_object_id)
        if article is None:
            return await self.retract_work(
                user_id=user_id,
                source_object_id=source_object_id,
                reason_code="user_removed",
                observed_at=observed_at,
            )
        return await self.record_work(
            user_id=user_id,
            source_object_id=source_object_id,
            payload=article,
            source="openalex" if str(source_object_id).startswith("W") else "deeplit",
            observed_at=observed_at,
        )

    async def retract_work(
        self,
        *,
        user_id: str,
        source_object_id: str,
        reason_code: str = "user_removed",
        observed_at: datetime | None = None,
    ) -> dict[str, Any] | None:
        user = _required_token(user_id, "user_id", 300)
        source_id = _required_token(source_object_id, "source_object_id", 500)
        reason = _safe_code(reason_code)
        if not reason:
            raise ValueError("reason_code invalido.")
        await self.ledger.ensure_indexes()
        latest = await self.ledger.latest_event(user, "work", source_id)
        if latest is None:
            return None
        if latest.get("operation") == "retraction":
            return _public_event(latest)
        fingerprint = _fingerprint(
            {
                "operation": "retraction",
                "source_object_id": source_id,
                "reason_code": reason,
                "supersedes_version": latest.get("object_version"),
            }
        )
        return await self._append_change(
            user_id=user,
            object_kind="work",
            source_object_id=source_id,
            fingerprint=fingerprint,
            signals={},
            source_refs=list(latest.get("source_refs") or []),
            retraction=True,
            reason_code=reason,
            observed_at=observed_at,
        )

    async def export_page(
        self,
        *,
        user_id: str,
        cursor: str | None = None,
        limit: int = 100,
        schema_version: str = SCHEMA_VERSION,
        generated_at: datetime | None = None,
    ) -> dict[str, Any]:
        user = _required_token(user_id, "user_id", 300)
        if schema_version != SCHEMA_VERSION:
            raise ValueError(f"schema_version no soportado: {schema_version}")
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= MAX_EVENTS:
            raise ValueError(f"limit debe estar entre 1 y {MAX_EVENTS}.")
        await self.ledger.ensure_indexes()
        after = _decode_cursor(cursor, user)
        high_water = await self.ledger.max_sequence(user)
        if after > high_water:
            raise ResearchIntelligenceCursorError(
                "El cursor esta por delante del historial disponible para este usuario."
            )
        rows = await self.ledger.events_after(user, after, limit)
        next_sequence = int(rows[-1]["sequence"]) if rows else after
        now = _utc(observed=generated_at)
        return {
            "schema_version": SCHEMA_VERSION,
            "provider": PROVIDER_ID,
            "cursor_before": _encode_cursor(user, after) if after else None,
            "cursor_after": _encode_cursor(user, next_sequence),
            "generated_at": _iso(now),
            "events": [_public_event(row) for row in rows],
        }

    async def _append_change(
        self,
        *,
        user_id: str,
        object_kind: str,
        source_object_id: str,
        fingerprint: str,
        signals: dict[str, Any],
        source_refs: list[str],
        retraction: bool,
        reason_code: str | None,
        observed_at: datetime | None,
    ) -> dict[str, Any]:
        await self.ledger.ensure_indexes()
        for _ in range(5):
            latest = await self.ledger.latest_event(user_id, object_kind, source_object_id)
            if latest is not None:
                if retraction and latest.get("operation") == "retraction":
                    return _public_event(latest)
                if (
                    not retraction
                    and latest.get("operation") != "retraction"
                    and latest.get("content_fingerprint") == fingerprint
                ):
                    return _public_event(latest)

            depth = int(latest.get("lineage_depth", 0)) + 1 if latest else 1
            supersedes = str(latest["object_version"]) if latest else None
            operation = (
                "retraction"
                if retraction
                else ("correction" if latest is not None else "upsert")
            )
            object_version = (
                f"v{depth}-tombstone-{fingerprint[:16]}"
                if retraction
                else f"v{depth}-{fingerprint[:16]}"
            )
            sequence = await self.ledger.next_sequence(user_id)
            event_id = "research-event:" + _fingerprint(
                {
                    "id_user": user_id,
                    "object_kind": object_kind,
                    "source_object_id": source_object_id,
                    "lineage_depth": depth,
                    "object_version": object_version,
                }
            )[:40]
            event = {
                "_id": event_id,
                "id_user": user_id,
                "sequence": sequence,
                "schema_version": SCHEMA_VERSION,
                "provider": PROVIDER_ID,
                "object_kind": object_kind,
                "source_object_id": source_object_id,
                "object_id": _provider_object_id(user_id, object_kind, source_object_id),
                "object_version": object_version,
                "operation": operation,
                "supersedes_version": supersedes if operation != "upsert" else None,
                "retrieved_at": _iso(_utc(observed=observed_at)),
                "source_refs": source_refs[:MAX_SOURCE_REFS],
                "signals": {} if retraction else signals,
                "lineage_depth": depth,
                "content_fingerprint": fingerprint,
                "reason_code": reason_code,
            }
            if await self.ledger.append_event(event):
                return _public_event(event)
        raise RuntimeError(
            "No se pudo publicar Research Intelligence por contencion concurrente."
        )


def _work_projection(
    source_object_id: str, payload: dict[str, Any], source: str
) -> tuple[dict[str, Any], list[str]]:
    if not isinstance(payload, dict):
        raise ValueError("payload de work debe ser un objeto.")
    title = _text(payload.get("title") or payload.get("display_name"), MAX_TEXT)
    doi = _text(payload.get("doi"), 1000)
    year = _bounded_int(payload.get("year") or payload.get("publication_year"), minimum=0)
    citations = _bounded_int(
        payload.get("citations") or payload.get("cited_by_count"), minimum=0
    )
    authors = _string_list(payload.get("authors"), MAX_LIST_VALUES)
    topics = _topics(payload.get("keywords"), MAX_LIST_VALUES)
    signals: dict[str, Any] = {
        "title": title or None,
        "doi": doi or None,
        "year": year,
        "authors": authors,
        "topics": topics,
        "citation_count": citations,
        "source_type": source,
        "article_id": source_object_id,
    }
    signals = {key: value for key, value in signals.items() if value not in (None, [], "")}
    refs = [f"{source}:{source_object_id}"]
    if doi:
        refs.append(f"doi:{doi}")
    return signals, refs[:MAX_SOURCE_REFS]


def _string_list(value: Any, maximum: int) -> list[str]:
    if value in (None, ""):
        return []
    if isinstance(value, str):
        raw_values = [value]
    elif isinstance(value, (list, tuple)):
        raw_values = list(value)
    else:
        raise ValueError("Lista de Research Intelligence invalida.")
    if len(raw_values) > maximum:
        raise ValueError("Lista de Research Intelligence excede el limite.")
    result: list[str] = []
    for raw in raw_values:
        if isinstance(raw, dict):
            raw = raw.get("display_name") or raw.get("name") or raw.get("key")
        if not isinstance(raw, str):
            raise ValueError("Research Intelligence solo admite strings normalizados.")
        clean = _text(raw, 1000)
        if clean and clean not in result:
            result.append(clean)
    return result


def _topics(value: Any, maximum: int) -> list[str]:
    if value in (None, ""):
        return []
    if not isinstance(value, (list, tuple)):
        raise ValueError("keywords/topics debe ser una lista.")
    if len(value) > maximum:
        raise ValueError("topics excede el limite.")
    result: list[str] = []
    for raw in value:
        if isinstance(raw, dict):
            raw = raw.get("key") or raw.get("display_name") or raw.get("name")
        if not isinstance(raw, str):
            raise ValueError("topic invalido.")
        clean = _text(raw, 1000)
        if clean and clean not in result:
            result.append(clean)
    return result


def _bounded_int(value: Any, *, minimum: int) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, bool):
        raise ValueError("Valor numerico invalido.")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Valor numerico invalido.") from exc
    if parsed < minimum:
        raise ValueError("Valor numerico fuera de rango.")
    return parsed


def _public_event(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "provider": PROVIDER_ID,
        "object_kind": str(event["object_kind"]),
        "object_id": str(event["object_id"]),
        "object_version": str(event["object_version"]),
        "operation": str(event["operation"]),
        "supersedes_version": (
            str(event["supersedes_version"])
            if event.get("supersedes_version") is not None
            else None
        ),
        "retrieved_at": str(event["retrieved_at"]),
        "source_refs": list(event.get("source_refs") or []),
        "signals": dict(event.get("signals") or {}),
    }


def _provider_object_id(user_id: str, object_kind: str, source_object_id: str) -> str:
    digest = _fingerprint(
        {"id_user": user_id, "object_kind": object_kind, "source_object_id": source_object_id}
    )
    return f"deeplit:{object_kind}:{digest[:32]}"


def _fingerprint(value: Any) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _tenant_digest(user_id: str) -> str:
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:24]


def _encode_cursor(user_id: str, sequence: int) -> str:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "tenant": _tenant_digest(user_id),
        "after_sequence": sequence,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_cursor(cursor: str | None, user_id: str) -> int:
    if cursor in (None, ""):
        return 0
    if not isinstance(cursor, str) or cursor != cursor.strip() or len(cursor) > MAX_CURSOR_LENGTH:
        raise ResearchIntelligenceCursorError("Cursor de Research Intelligence invalido.")
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ResearchIntelligenceCursorError("Cursor de Research Intelligence invalido.") from exc
    if not isinstance(payload, dict):
        raise ResearchIntelligenceCursorError("Cursor de Research Intelligence invalido.")
    if payload.get("schema_version") != SCHEMA_VERSION:
        raise ResearchIntelligenceCursorError("Cursor de otra version de schema.")
    if payload.get("tenant") != _tenant_digest(user_id):
        raise ResearchIntelligenceCursorError("Cursor no pertenece al usuario autenticado.")
    sequence = payload.get("after_sequence")
    if isinstance(sequence, bool) or not isinstance(sequence, int) or sequence < 0:
        raise ResearchIntelligenceCursorError("Cursor de Research Intelligence invalido.")
    return sequence


def _required_token(value: Any, field: str, maximum: int) -> str:
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    if not value or value != value.strip() or len(value) > maximum:
        raise ValueError(f"{field} invalido.")
    if any(char in value for char in "\r\n\t"):
        raise ValueError(f"{field} invalido.")
    return value


def _safe_code(value: Any) -> str | None:
    if isinstance(value, str) and _SAFE_CODE.fullmatch(value):
        return value
    return None


def _text(value: Any, maximum: int) -> str:
    return " ".join(str(value or "").split())[:maximum]


def _utc(*, observed: datetime | None) -> datetime:
    value = observed or datetime.now(UTC)
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timestamp de Research Intelligence debe incluir zona horaria.")
    return value.astimezone(UTC)


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


__all__ = [
    "SCHEMA_VERSION",
    "PROVIDER_ID",
    "MongoResearchIntelligenceLedger",
    "ResearchIntelligenceCursorError",
    "ResearchIntelligenceExportService",
]
