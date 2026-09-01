# GoalMind Research Intelligence provider v1

Status: implementation contract for `deepLit#1` and GoalMind `VirtualAssistant-private#327`.

## Purpose

deepLit is the scientific-domain authority. GoalMind consumes a bounded Research Intelligence delta stream and must not duplicate deepLit's OpenAlex, PDF, RAG, evidence-extraction or scientific-graph stack.

The provider contract exists because deepLit's legacy scientific rows are mutable/upserted and some paths hard-delete records. Those rows are **not** a safe incremental-change authority. V1 therefore introduces a provider-owned append-only ledger with explicit versions, predecessor lineage and tombstones.

## Non-negotiable invariants

1. The authenticated deepLit user determines the export tenant. No API accepts a caller-supplied user ID as stream authority.
2. Provider event identity, sequence, lineage and cursor are tenant-scoped even when two users reference the same global scientific identifier such as an OpenAlex `W...`.
3. The append-only Research Intelligence ledger is the delta authority. `updated_at > cursor` over legacy rows is forbidden.
4. An unchanged projection is idempotent and does not create a new version.
5. A changed projection emits `correction` with `supersedes_version`.
6. Removal emits an explicit `retraction` tombstone rather than silently disappearing from history.
7. Cursor replay is deterministic for unchanged provider history. A cursor from another tenant, another schema version, malformed input or a future high-water mark fails closed.
8. Raw PDFs, abstracts/full text, prompts, chain-of-thought, credentials, diagnostics, collection membership, internal paths and storage locators are excluded by construction.
9. GoalMind receives external scientific evidence. It does not receive authority to mutate deepLit scientific state.
10. A provider-owned reconciliation pass can repair a crash gap between a successful legacy mutation and event publication without rewriting previous provider history.
11. Same-work/two-users behavior is tested adversarially at both identity and visibility boundaries.

## Authoritative schema

`deeplit-research-intelligence/v1`

Page envelope:

```json
{
  "schema_version": "deeplit-research-intelligence/v1",
  "provider": "deeplit",
  "cursor_before": null,
  "cursor_after": "<opaque tenant-scoped cursor>",
  "generated_at": "2026-09-01T12:00:00Z",
  "events": []
}
```

Work event:

```json
{
  "schema_version": "deeplit-research-intelligence/v1",
  "provider": "deeplit",
  "object_kind": "work",
  "object_id": "deeplit:work:<tenant-scoped digest>",
  "object_version": "v2-<content digest>",
  "operation": "correction",
  "supersedes_version": "v1-<content digest>",
  "retrieved_at": "2026-09-01T12:00:00Z",
  "source_refs": ["openalex:W123", "doi:10.1000/example"],
  "signals": {
    "title": "...",
    "doi": "...",
    "year": 2026,
    "authors": ["..."],
    "topics": ["..."],
    "citation_count": 12,
    "source_type": "openalex",
    "article_id": "W123"
  }
}
```

V1 deliberately limits the provider surface to `work`. Author strings remain observations attached to work metadata; GoalMind must not automatically merge them into Personal Person identities. Future author/institution/topic/evidence first-class objects require an explicit versioned extension.

## Persistence

Provider collections:

- `research_intelligence_events`: immutable tenant-scoped event ledger.
- `research_intelligence_counters`: tenant-scoped monotonic sequence allocation.

Required unique indexes:

- `(id_user, sequence)`;
- `(id_user, object_kind, source_object_id, lineage_depth)`.

`source_object_id` preserves the native scientific identifier for producer-side reconciliation. It is never used as cross-tenant provider event identity. Public `object_id` is derived from tenant + kind + source ID.

Concurrent writers may consume an unused sequence when they race on the same object depth; sequence gaps are permitted. Reusing or rewriting a committed event is not.

## Tenant-scoped legacy visibility

The compatibility reader never treats legacy `article.id_user` as provider authority. User visibility is reconstructed from that user's own collection identifiers plus the legacy per-user library identifier. A work is capturable for a tenant only when the global article row is currently referenced by one of those tenant-owned scopes.

Consequences:

- users A and B may both reference OpenAlex `W123` while receiving distinct provider object IDs, versions and cursors;
- A removing `W123` from all A-owned scopes creates only A's tombstone even if the same global row remains because B still references it;
- collection IDs themselves are not exported and cannot affect the work content fingerprint;
- a legacy global row cannot make B inherit A's provider history.

## Cursor and deterministic replay

The opaque cursor payload contains:

- provider schema version;
- a digest of the authenticated tenant, never the raw user ID;
- exclusive `after_sequence` high-water mark.

It is not an authorization token: JWT authentication remains the HTTP authority. Its tenant digest is an additional fail-closed replay guard. Consumers may replay older valid cursors; they cannot advance beyond the provider high-water mark.

`generated_at` is deterministic for a stable page: by default it is the `retrieved_at` of the last event returned, or the fixed empty-ledger epoch for an empty initial history. Response wall-clock time is deliberately not part of page identity.

## OpenAlex integration and crash-gap recovery

The authenticated OpenAlex save path publishes or refreshes the corresponding tenant-visible work after the legacy save succeeds. The authenticated unsave path rechecks tenant visibility: it refreshes the work if it is still present in another user-owned collection, otherwise it emits only that user's tombstone.

Mongo legacy state and the provider ledger cannot be made one atomic transaction around external OpenAlex/graph behavior. V1 therefore provides `reconcile_user_library()` and an authenticated provider-maintenance endpoint. Reconciliation:

1. enumerates the authenticated user's currently visible works;
2. idempotently publishes missing/upgraded observations;
3. compares them with the latest immutable provider events;
4. appends `reconcile_missing` tombstones for previously active provider works no longer visible;
5. never edits or deletes provider history and never mutates scientific library rows.

This is the durable recovery path for a process failure after a scientific save/remove but before provider publication.

## HTTP boundary

GoalMind consumer endpoints are authenticated and read-only:

- `GET /research-intelligence/contract`
- `GET /research-intelligence/delta?cursor=...&limit=...&schema_version=...`

Provider maintenance endpoint:

- `POST /research-intelligence/reconcile`

No endpoint accepts `user_id`; `get_current_user()` supplies the tenant identity. Reconciliation mutates only the append-only observation ledger and is not scientific-state authority.

Validation errors are 400. Cursor ownership/history conflicts are 409. Provider transport/auth errors remain visible to GoalMind so its XINT source-isolation policy can classify an outage without treating absence as negative scientific evidence.

## GoalMind reconciliation

GoalMind draft PR #418 currently uses `deeplit-research-intelligence/v1-candidate`. After this provider contract is validated and merged, #418 must:

1. replace the candidate schema with authoritative `deeplit-research-intelligence/v1`;
2. implement a concrete authenticated transport bound to exactly one GoalMind user/provider credential;
3. consume only contract/delta, not the provider maintenance endpoint as ordinary read transport;
4. preserve cursor/idempotency/correction/retraction behavior already covered by its preparatory tests;
5. retain author ambiguity and external-evidence authority boundaries;
6. prove one provider delta end-to-end before closing XINT-2.

## Acceptance tests

The provider suite must prove at minimum:

- same OpenAlex work for users A/B has different provider object IDs and cursors;
- A removal/tombstone does not alter B history even while the global scientific row remains;
- duplicate capture is idempotent;
- replay is deterministic for stable source ledger;
- correction and retraction preserve predecessor versions;
- reconciliation repairs a missed upsert and a missed tombstone;
- cross-tenant, malformed and future cursors fail closed;
- sensitive/internal fields never enter JSON export;
- wrong schema/page bounds fail closed;
- a retraction without prior provider authority does not fabricate history.
