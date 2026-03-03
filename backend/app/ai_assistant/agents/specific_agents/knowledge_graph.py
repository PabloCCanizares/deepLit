"""
Wrapper de compatibilidad para creación de Knowledge Graph.
La implementación actual vive en KnowledgeGraphService.
"""
import logging

from app.services.knowledge_graph_service import KnowledgeGraphService

logger = logging.getLogger(__name__)


def create_knowledge_graph(docs, user_id: str, article_id: str, title: str = "", collection_ids=None):
    try:
        service = KnowledgeGraphService()
        return service.ingest_documents(
            user_id=user_id,
            article_id=article_id,
            title=title,
            docs=docs,
            collection_ids=collection_ids or [],
            reprocess=True,
        )
    except Exception as exc:
        logger.warning("Error al crear Knowledge Graph (non-blocking): %s", exc)
        return {"enabled": False, "error": str(exc)}
