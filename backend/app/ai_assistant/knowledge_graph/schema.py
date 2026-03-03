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


def validate_graph_documents(graph_documents) -> Dict:
    node_total = 0
    rel_total = 0
    valid_nodes = 0
    valid_relationships = 0
    invalid_relationships = []

    for graph_doc in graph_documents:
        nodes = getattr(graph_doc, "nodes", []) or []
        relationships = getattr(graph_doc, "relationships", []) or []
        node_total += len(nodes)
        rel_total += len(relationships)

        for node in nodes:
            node_type = sanitize_entity_type(getattr(node, "type", None))
            if node_type in KG_NODE_TYPES and node_key(node):
                valid_nodes += 1

        for rel in relationships:
            rel_type = normalize_rel_type(getattr(rel, "type", None))
            source = getattr(rel, "source", None)
            target = getattr(rel, "target", None)
            source_type = sanitize_entity_type(getattr(source, "type", None))
            target_type = sanitize_entity_type(getattr(target, "type", None))
            triple = (source_type, rel_type, target_type)
            if rel_type and triple in RELATIONSHIP_RULES and node_key(source) and node_key(target):
                valid_relationships += 1
            else:
                invalid_relationships.append(
                    {
                        "source_type": source_type,
                        "relationship": rel_type or getattr(rel, "type", None),
                        "target_type": target_type,
                    }
                )

    node_validity = valid_nodes / node_total if node_total else 0.0
    rel_validity = valid_relationships / rel_total if rel_total else 0.0
    extraction_score = round((0.4 * node_validity) + (0.6 * rel_validity), 4)

    return {
        "nodes_total": node_total,
        "nodes_valid": valid_nodes,
        "relationships_total": rel_total,
        "relationships_valid": valid_relationships,
        "invalid_relationships": invalid_relationships[:30],
        "node_validity": round(node_validity, 4),
        "relationship_validity": round(rel_validity, 4),
        "extraction_score": extraction_score,
    }
