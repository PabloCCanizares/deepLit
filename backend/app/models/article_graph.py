"""
Modelos del grafo de artículos.

Estos modelos son únicamente para tipar las respuestas del endpoint del
grafo (no para validar input). Se mantienen ligeros porque la respuesta
real se serializa dentro del ``StandardResponse``.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class ArticleGraphNode(BaseModel):
    """Nodo del grafo (Article, Author, Keyword, Category, Type)."""
    id: str = Field(..., description="Identificador único del nodo en Neo4j")
    type: str = Field(..., description="Etiqueta principal del nodo")
    label: str = Field(..., description="Texto legible del nodo")
    article_id: Optional[str] = Field(None, description="ID del artículo (solo para nodos Article)")
    year: Optional[int] = Field(None, description="Año (solo para nodos Article)")


class ArticleGraphEdge(BaseModel):
    """Relación dirigida entre dos nodos del grafo."""
    source: str = Field(..., description="ID del nodo origen")
    target: str = Field(..., description="ID del nodo destino")
    type: str = Field(..., description="Tipo de relación (WROTE, HAS_KEYWORD, ...)")


class ArticleGraphStats(BaseModel):
    """Resumen de cardinalidad del grafo del usuario."""
    articles: int = 0
    authors: int = 0
    keywords: int = 0
    categories: int = 0
    types: int = 0
    relationships: int = 0


class ArticleGraphResponse(BaseModel):
    """Estructura de la respuesta de ``/article-graph``."""
    enabled: bool = Field(..., description="True si Neo4j está disponible y devolvió datos")
    nodes: List[ArticleGraphNode] = Field(default_factory=list)
    edges: List[ArticleGraphEdge] = Field(default_factory=list)
    stats: ArticleGraphStats = Field(default_factory=ArticleGraphStats)
    message: Optional[str] = Field(None, description="Mensaje informativo cuando enabled=False")
