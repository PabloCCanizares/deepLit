from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.controllers.knowledge_graph_controller import KnowledgeGraphController
from app.core import StandardResponse, create_response_examples, get_current_user
from app.models import KnowledgeGraphBackfillRequest


router = APIRouter(prefix="/ai-assistant/knowledge-graph", tags=["Knowledge Graph"])


@router.get(
    "/schema",
    response_model=StandardResponse,
    summary="Obtener esquema del knowledge graph",
    responses=create_response_examples(
        success_example={"message": "Esquema del grafo obtenido", "data": {"nodes": [], "relationships": []}},
        error_example={"message": "Error al obtener esquema", "error": "No autorizado", "error_code": "AUTHENTICATION_ERROR"},
    ),
)
async def get_schema(
    current_user: dict = Depends(get_current_user),
    controller: KnowledgeGraphController = Depends(),
):
    return await controller.get_schema(current_user)


@router.get(
    "/stats",
    response_model=StandardResponse,
    summary="Obtener métricas del grafo para usuario/colección",
)
async def get_stats(
    collection_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    controller: KnowledgeGraphController = Depends(),
):
    return await controller.get_stats(current_user=current_user, collection_id=collection_id)


@router.get(
    "/entities",
    response_model=StandardResponse,
    summary="Buscar entidades en el grafo",
)
async def search_entities(
    q: str = Query(default="", min_length=0),
    collection_id: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    controller: KnowledgeGraphController = Depends(),
):
    return await controller.search_entities(
        current_user=current_user,
        query=q,
        collection_id=collection_id,
        limit=limit,
    )


@router.get(
    "/entity/{entity_name}/neighbors",
    response_model=StandardResponse,
    summary="Obtener vecinos de una entidad",
)
async def get_entity_neighbors(
    entity_name: str,
    collection_id: Optional[str] = None,
    limit: int = Query(default=25, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    controller: KnowledgeGraphController = Depends(),
):
    return await controller.get_entity_neighbors(
        current_user=current_user,
        entity_name=entity_name,
        collection_id=collection_id,
        limit=limit,
    )


@router.post(
    "/backfill",
    response_model=StandardResponse,
    summary="Backfill del grafo para papers antiguos",
)
async def backfill(
    payload: KnowledgeGraphBackfillRequest,
    current_user: dict = Depends(get_current_user),
    controller: KnowledgeGraphController = Depends(),
):
    return await controller.backfill(current_user=current_user, payload=payload)
