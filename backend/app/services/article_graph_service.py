"""
Servicio del grafo de artículos (Neo4j).

Construye un grafo simple a partir de los metadatos de cada artículo:

- Cada artículo se representa con un nodo ``Article``.
- Cada autor se representa con un nodo ``Author`` y queda conectado al
  artículo mediante la relación ``WROTE``.
- Cada palabra clave se representa con un nodo ``Keyword`` enlazado al
  artículo con la relación ``HAS_KEYWORD``.
- La categoría se representa con un nodo ``Category`` (relación
  ``IN_CATEGORY``) y el tipo con un nodo ``Type`` (relación ``OF_TYPE``).

Las operaciones se realizan con ``MERGE`` para evitar duplicar nodos o
relaciones cuando se ingieren artículos repetidos.

Si Neo4j no está configurado el servicio se comporta como no-op para no
romper el flujo principal de la aplicación.

Al arrancar la API se ejecuta una sincronización MongoDB → Neo4j para
recuperar artículos añadidos antes de existir esta integración (MERGE
idempotente).
"""
import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

from app.repositories.article_graph_repository import ArticleGraphRepository
from app.repositories.article_repository import ArticleRepository

logger = logging.getLogger(__name__)


class ArticleGraphService:

    def __init__(self):
        self.repo = ArticleGraphRepository()

    # ------------------------------------------------------------------
    # API pública
    # ------------------------------------------------------------------
    def is_available(self) -> bool:
        """Indica si Neo4j está disponible."""
        return self.repo.is_available()

    def ingest_article(self, article: Dict[str, Any], user_id: Optional[str] = None) -> bool:
        """
        Incorpora un artículo al grafo. Tolera errores y nunca lanza
        excepciones para no afectar al flujo principal.
        """
        if not article:
            return False

        article_id = article.get("_id") or article.get("id")
        if not article_id:
            return False

        owner_id = user_id or article.get("id_user")
        if not owner_id:
            return False

        try:
            return self.repo.upsert_article_graph(
                user_id=str(owner_id),
                article_id=str(article_id),
                title=article.get("title") or "",
                authors=self._extract_authors(article.get("authors")),
                keywords=self._extract_keywords(article.get("keywords")),
                category=self._extract_string(article.get("category")),
                article_type=self._extract_string(article.get("type")),
                year=self._extract_year(article.get("year")),
            )
        except Exception as exc:
            logger.warning(
                "No se pudo ingerir el articulo %s en el grafo: %s",
                article_id,
                exc,
            )
            return False

    def remove_article(self, article_id: str, user_id: str) -> bool:
        """Elimina un artículo y sus huérfanos del grafo."""
        if not article_id or not user_id:
            return False

        try:
            return self.repo.delete_article(user_id=str(user_id), article_id=str(article_id))
        except Exception as exc:
            logger.warning(
                "No se pudo eliminar el articulo %s del grafo: %s",
                article_id,
                exc,
            )
            return False

    def get_user_graph(self, user_id: str, limit: int = 250) -> Dict[str, Any]:
        """Devuelve el grafo del usuario para visualización."""
        if not user_id:
            return self._empty_graph()

        if not self.repo.is_available():
            return self._empty_graph(message="Neo4j no configurado")

        try:
            graph = self.repo.get_user_graph(user_id=str(user_id), limit=limit)
            stats = self.repo.get_user_graph_stats(user_id=str(user_id))
            return {
                "enabled": True,
                "nodes": graph.get("nodes", []),
                "edges": graph.get("edges", []),
                "stats": stats,
            }
        except Exception as exc:
            logger.warning("No se pudo recuperar el grafo del usuario %s: %s", user_id, exc)
            return self._empty_graph(message="Error consultando el grafo")

    def get_user_graph_stats(self, user_id: str) -> Dict[str, Any]:
        """Devuelve el resumen del grafo del usuario."""
        if not user_id:
            return {"enabled": False, "stats": self._empty_stats()}

        if not self.repo.is_available():
            return {"enabled": False, "stats": self._empty_stats(), "message": "Neo4j no configurado"}

        try:
            stats = self.repo.get_user_graph_stats(user_id=str(user_id))
            return {"enabled": True, "stats": stats}
        except Exception as exc:
            logger.warning("No se pudieron leer stats del grafo: %s", exc)
            return {"enabled": False, "stats": self._empty_stats(), "message": "Error consultando el grafo"}

    async def sync_all_from_mongo(self) -> Dict[str, Any]:
        """
        Lee todos los artículos elegibles en MongoDB y los vuelca al grafo
        con MERGE (no duplica; cubre artículos antiguos sin pasar por el hook).

        Pensado para ejecutarse una vez al iniciar el servidor.
        """
        if not self.is_available():
            logger.info(
                "Sincronización grafo-artículos omitida: Neo4j no configurado o no accesible",
            )
            return {
                "ran": False,
                "reason": "neo4j_unavailable",
                "total": 0,
                "ingested_ok": 0,
                "failed": 0,
            }

        article_repo = ArticleRepository()
        try:
            articles = await article_repo.find_all_for_article_graph_sync()
        except Exception as exc:
            logger.warning("No se pudo leer artículos para sincronizar el grafo: %s", exc)
            return {
                "ran": False,
                "reason": "mongo_error",
                "error": str(exc),
                "total": 0,
                "ingested_ok": 0,
                "failed": 0,
            }

        ingested_ok = 0
        failed = 0
        for article in articles:
            try:
                ok = await asyncio.to_thread(self.ingest_article, article)
                if ok:
                    ingested_ok += 1
                else:
                    failed += 1
            except Exception as exc:
                failed += 1
                logger.warning(
                    "Fallo al sincronizar articulo %s en Neo4j: %s",
                    article.get("_id"),
                    exc,
                )

        logger.info(
            "Sincronización grafo-artículos completada: %s documentos MongoDB, %s ingestados en Neo4j, %s fallidos",
            len(articles),
            ingested_ok,
            failed,
        )

        return {
            "ran": True,
            "total": len(articles),
            "ingested_ok": ingested_ok,
            "failed": failed,
        }

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------
    def _empty_graph(self, message: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "enabled": False,
            "nodes": [],
            "edges": [],
            "stats": self._empty_stats(),
        }
        if message:
            payload["message"] = message
        return payload

    def _empty_stats(self) -> Dict[str, int]:
        return {
            "articles": 0,
            "authors": 0,
            "keywords": 0,
            "categories": 0,
            "types": 0,
            "relationships": 0,
        }

    def _extract_string(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return None

    def _extract_year(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, int):
            return value if 1000 <= value <= 9999 else None
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            if stripped[:4].isdigit():
                return int(stripped[:4])
        return None

    def _extract_authors(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        if not isinstance(value, list):
            return []

        authors: List[str] = []
        for item in value:
            if item is None:
                continue
            if isinstance(item, str):
                text = item.strip()
                if text:
                    authors.append(text)
                continue
            if isinstance(item, dict):
                raw = (
                    item.get("display_name")
                    or item.get("name")
                    or item.get("author")
                )
                if raw is None:
                    nested = item.get("author")
                    if isinstance(nested, dict):
                        raw = nested.get("display_name") or nested.get("name")
                if raw is not None:
                    text = str(raw).strip()
                    if text:
                        authors.append(text)
        return authors

    def _extract_keywords(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            parts = re.split(r"[;,]", value)
            return [p.strip() for p in parts if p.strip()]
        if not isinstance(value, list):
            return []

        keywords: List[str] = []
        for item in value:
            if item is None:
                continue
            if isinstance(item, str):
                text = item.strip()
                if text:
                    keywords.append(text)
                continue
            if isinstance(item, dict):
                raw = item.get("key") or item.get("display_name") or item.get("name")
                if raw is None:
                    continue
                text = str(raw).strip()
                if text:
                    keywords.append(text)

        # Quitar duplicados manteniendo el orden
        seen = set()
        unique_keywords: List[str] = []
        for kw in keywords:
            lowered = kw.lower()
            if lowered not in seen:
                seen.add(lowered)
                unique_keywords.append(kw)
        return unique_keywords
