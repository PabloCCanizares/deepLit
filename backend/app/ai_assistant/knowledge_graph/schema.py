from typing import Dict, List, Optional, Tuple


KG_NODE_TYPES = [
    "Paper",
    "Author",
    "Concept",
    "Method",
    "Dataset",
    "Organization",
    "Venue",
    "Finding",
]

KG_RELATIONSHIP_SCHEMA: List[Tuple[str, str, str]] = [
    ("Paper", "HAS_AUTHOR", "Author"),
    ("Paper", "USES_METHOD", "Method"),
    ("Paper", "USES_DATASET", "Dataset"),
    ("Paper", "COVERS_CONCEPT", "Concept"),
    ("Paper", "REPORTS_FINDING", "Finding"),
    ("Paper", "PUBLISHED_IN", "Venue"),
    ("Paper", "AFFILIATED_WITH", "Organization"),
    ("Method", "ADDRESSES_CONCEPT", "Concept"),
    ("Finding", "ABOUT_CONCEPT", "Concept"),
]

KG_RELATIONSHIP_TYPES = sorted({relationship for _, relationship, _ in KG_RELATIONSHIP_SCHEMA})
RELATIONSHIP_RULES = {(s, r, t) for s, r, t in KG_RELATIONSHIP_SCHEMA}


def sanitize_entity_type(entity_type: Optional[str]) -> str:
    value = (entity_type or "Concept").strip()
    return value if value in KG_NODE_TYPES else "Concept"


def normalize_rel_type(rel_type: Optional[str]) -> Optional[str]:
    candidate = (rel_type or "").strip().upper()
    return candidate if candidate in KG_RELATIONSHIP_TYPES else None


def node_key(node) -> str:
    node_id = str(getattr(node, "id", "")).strip()
    return node_id.lower()


def get_schema_descriptor() -> Dict:
    return {
        "nodes": KG_NODE_TYPES,
        "relationships": [
            {"source": source, "type": rel_type, "target": target}
            for source, rel_type, target in KG_RELATIONSHIP_SCHEMA
        ],
        "criteria": {
            "allowed_node_types_only": True,
            "allowed_relationship_triples_only": True,
            "all_edges_must_be_user_scoped": True,
            "all_edges_must_include_article_scope": True,
        },
    }
