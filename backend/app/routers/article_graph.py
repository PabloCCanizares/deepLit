"""
Rutas del grafo de artículos.

Expone los endpoints necesarios para que el dashboard pueda visualizar
el grafo construido en Neo4j.
"""
from fastapi import APIRouter, Depends, Query

from app.controllers.article_graph_controller import ArticleGraphController
from app.core import StandardResponse, create_response_examples, get_current_user


router = APIRouter(prefix="/article-graph", tags=["Article Graph"])


@router.get(
    "/",
    response_model=StandardResponse,
    summary="Obtener el grafo de artículos del usuario",
    responses=create_response_examples(
        success_example={
            "message": "Grafo de artículos recuperado",
            "data": {
                "enabled": True,
                "nodes": [],
                "edges": [],
                "stats": {
                    "articles": 0,
                    "authors": 0,
                    "keywords": 0,
                    "categories": 0,
                    "types": 0,
                    "relationships": 0,
                },
            },
        },
        error_example={
            "message": "Error al recuperar el grafo",
            "error": "Token inválido o expirado",
            "error_code": "AUTHENTICATION_ERROR",
        },
    ),
)
async def get_article_graph(
    limit: int = Query(default=250, ge=1, le=1000, description="Número máximo de nodos a devolver"),
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Devuelve los nodos y relaciones del grafo del usuario actual."""
    return await controller.get_user_graph(current_user=current_user, limit=limit)


@router.get(
    "/stats",
    response_model=StandardResponse,
    summary="Obtener estadísticas del grafo de artículos",
)
async def get_article_graph_stats(
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Devuelve las cardinalidades del grafo del usuario."""
    return await controller.get_stats(current_user=current_user)
