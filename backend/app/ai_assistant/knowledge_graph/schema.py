"""Esquema permitido del Knowledge Graph semántico.

Define los tipos de nodo y las triples (origen, tipo de relación, destino)
que aceptamos del LLM al expandir un artículo. Cualquier nodo o
relación que no respete este esquema es descartado.
"""
from typing import List, Optional, Tuple


KG_NODE_TYPES: List[str] = [
    "Organización",
    "Problema",
    "Concepto",
    "Método",
    "Modelo",
    "Dataset",
    "Métrica",
    "Hallazgo",
    "Limitación",
]

KG_RELATIONSHIP_SCHEMA: List[Tuple[str, str, str]] = [
    ("Paper",    "ABORDA_PROBLEMA",    "Problema"),
    ("Paper",    "CUBRE_CONCEPTO",     "Concepto"),
    ("Paper",    "USA_METODO",         "Método"),
    ("Paper",    "PROPONE_MODELO",     "Modelo"),
    ("Paper",    "USA_DATASET",        "Dataset"),
    ("Paper",    "EVALUA_CON",         "Métrica"),
    ("Paper",    "REPORTA_HALLAZGO",   "Hallazgo"),
    ("Paper",    "REPORTA_LIMITACION", "Limitación"),
    ("Método",   "RESUELVE",           "Problema"),
    ("Modelo",   "CONSTRUYE_SOBRE",    "Método"),
    ("Dataset",  "USADO_PARA",         "Problema"),
    ("Concepto", "RELACIONADO_CON",    "Concepto"),
    ("Hallazgo", "APOYA",              "Hallazgo"),
    ("Hallazgo", "CONTRADICE",         "Hallazgo"),
]

KG_RELATIONSHIP_TYPES: List[str] = sorted({rel for _, rel, _ in KG_RELATIONSHIP_SCHEMA})
RELATIONSHIP_RULES = {(s, r, t) for s, r, t in KG_RELATIONSHIP_SCHEMA}

KG_LLM_ALLOWED_RELATIONSHIPS: List[Tuple[str, str, str]] = [
    (s, r, t)
    for s, r, t in KG_RELATIONSHIP_SCHEMA
    if s in KG_NODE_TYPES and t in KG_NODE_TYPES
]


def sanitize_entity_type(entity_type: Optional[str]) -> str:
    """Devuelve un tipo válido del esquema; ``"Concepto"`` como fallback."""
    value = (entity_type or "Concepto").strip()
    return value if value in KG_NODE_TYPES else "Concepto"


def normalize_rel_type(rel_type: Optional[str]) -> Optional[str]:
    """Devuelve el tipo de relación en mayúsculas si pertenece al esquema."""
    candidate = (rel_type or "").strip().upper()
    return candidate if candidate in KG_RELATIONSHIP_TYPES else None


def node_key(node) -> str:
    """Construye una clave canónica ``tipo:id`` para deduplicar entidades."""
    node_id = str(getattr(node, "id", "")).strip()
    entity_type = sanitize_entity_type(getattr(node, "type", None)).lower()
    return f"{entity_type}:{node_id.lower()}"
