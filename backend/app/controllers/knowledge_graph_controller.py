from fastapi import Depends

from app.core import StandardResponse
from app.models import KnowledgeGraphBackfillRequest
from app.services.knowledge_graph_service import KnowledgeGraphService


class KnowledgeGraphController:
    def __init__(self, service: KnowledgeGraphService = Depends()):
        self.service = service

    async def get_schema(self, current_user: dict) -> StandardResponse:
        data = self.service.get_schema()
        return StandardResponse(success=True, message="Esquema del grafo obtenido", data=data)

    async def get_stats(self, current_user: dict, collection_id: str = None) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.get_stats(user_id=user_id, collection_id=collection_id)
        return StandardResponse(success=True, message="Metricas del grafo obtenidas", data=data)

    async def search_entities(
        self,
        current_user: dict,
        query: str,
        collection_id: str = None,
        limit: int = 20,
    ) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.search_entities(
            user_id=user_id,
            query=query,
            collection_id=collection_id,
            limit=limit,
        )
        return StandardResponse(success=True, message="Entidades encontradas", data={"items": data})

    async def get_entity_neighbors(
        self,
        current_user: dict,
        entity_name: str,
        collection_id: str = None,
        limit: int = 25,
    ) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.get_entity_neighbors(
            user_id=user_id,
            entity_name=entity_name,
            collection_id=collection_id,
            limit=limit,
        )
        return StandardResponse(success=True, message="Vecinos de entidad obtenidos", data={"items": data})

    async def get_quality_logs(
        self,
        current_user: dict,
        article_id: str = None,
        limit: int = 50,
    ) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.get_quality_logs(user_id=user_id, article_id=article_id, limit=limit)
        return StandardResponse(success=True, message="Calidad de extraccion obtenida", data={"items": data})

    async def backfill(
        self,
        current_user: dict,
        payload: KnowledgeGraphBackfillRequest,
    ) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.backfill(
            user_id=user_id,
            collection_id=payload.collection_id,
            limit=payload.limit,
            reprocess=payload.reprocess,
        )
        return StandardResponse(success=True, message="Backfill de knowledge graph completado", data=data)
