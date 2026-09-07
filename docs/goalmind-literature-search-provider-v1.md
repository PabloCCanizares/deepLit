# GoalMind literature search provider v1

This document freezes DeepLit's synchronous read-only provider boundary for GoalMind's canonical `literature.search/v1` capability.

It is intentionally separate from `deeplit-research-intelligence/v1`. The Research Intelligence contract is an incremental append-only delta source for XINT-2; this endpoint is an on-demand QUERY and does not publish, persist, retract, checkpoint, or mutate scientific evidence.

## Endpoint

`POST /goalmind/literature/search/v1`

Authentication uses DeepLit's existing bearer authentication dependency. The caller cannot supply a DeepLit user/tenant identifier in the request body.

## Request

The JSON object accepts exactly:

```json
{
  "query": "surrogate optimization cloud fog",
  "limit": 20,
  "offset": 0,
  "year_from": 2020,
  "year_to": 2026
}
```

`query` is required, length 1..2048. `limit` is optional, 1..100, default 10. `offset` is optional, non-negative, default 0. `year_from` and `year_to` are optional integers >=1000; when both are present `year_from <= year_to` is required. Extra fields are rejected.

The adapter translates the query to DeepLit's existing OpenAlex/PyAlex provider stack. Publication ranges use OpenAlex date filters. A future `year_to` is capped to the current UTC date; a stricter past upper bound is preserved. A lower bound wholly in the future returns an empty result without an external call.

Arbitrary offsets are supported, including offsets not divisible by the requested limit. Internally the provider uses fixed 100-item OpenAlex pages and needs at most two page reads for one GoalMind response because `limit <= 100`.

## Response

The response is the canonical object directly, with no DeepLit `StandardResponse` wrapper:

```json
{
  "works": [
    {
      "source_ref": "https://openalex.org/W123",
      "title": "Example title",
      "year": 2026,
      "category": "Computer Science"
    }
  ],
  "total": 1
}
```

Only `source_ref`, `title`, `year`, and `category` are exposed for each work. `source_ref` is normalized to the canonical OpenAlex work reference rather than a MongoDB/DeepLit object identifier. Missing/non-integer years become `null`; missing/empty categories become `null`. Malformed OpenAlex identity/count metadata fails closed rather than widening the wire schema.

## Authority and side effects

This operation is read-only external evidence. It does not save/unsave articles, modify collections, update Neo4j, write Research Intelligence history, create cursors, perform synthesis, or grant any GoalMind execution/memory authority. GoalMind remains responsible for TAC planning, provider routing, verification, policy, and any later evidence promotion.

## GoalMind binding expectation

GoalMind IH-7B must bind this endpoint only after validating a reviewed Integration Hub package and machine contract whose input/output JSON Schemas exactly equal canonical `literature.search/v1`. Provider identity, URL, auth reference, and operation ID remain outside the semantic capability fingerprint.
