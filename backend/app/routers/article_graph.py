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

@router.post(
    "/embeddings/compute",
    response_model=StandardResponse,
    summary="Calcular embeddings FastRP para el grafo del usuario",
)
async def compute_embeddings(
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """
    Proyecta el grafo completo del usuario (schema-agnostic), ejecuta
    FastRP y persiste los vectores en Neo4j.

    Debe llamarse antes de usar el endpoint de similitud.
    Es idempotente: si ya existen embeddings, los sobreescribe.
    """
    return await controller.compute_embeddings(current_user=current_user)


@router.get(
    "/embeddings/status",
    response_model=StandardResponse,
    summary="Estado de embeddings del usuario",
)
async def get_embedding_status(
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Cuántos nodos del usuario tienen embeddings calculados."""
    return await controller.get_embedding_status(current_user=current_user)


@router.delete(
    "/embeddings",
    response_model=StandardResponse,
    summary="Eliminar embeddings del usuario",
)
async def clear_embeddings(
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Borra la propiedad de embedding de todos los nodos del usuario."""
    return await controller.clear_embeddings(current_user=current_user)


@router.get(
    "/similar",
    response_model=StandardResponse,
    summary="Encontrar nodos similares por embedding coseno",
)
async def find_similar_nodes(
    node_label: str = Query(..., description="Etiqueta Neo4j del nodo. Ej: Article, Author, Keyword"),
    node_id_prop: str = Query(..., description="Propiedad que identifica el nodo fuente. Ej: article_id, name_lower, key_lower"),
    node_id_value: str = Query(..., description="Valor de la propiedad identificadora"),
    label_prop: str = Query(..., description="Propiedad a mostrar como texto. Ej: title, name, key"),
    min_similarity: float = Query(default=0.7, ge=0.0, le=1.0, description="Umbral de similitud coseno (0–1)"),
    top_k: int = Query(default=10, ge=1, le=50, description="Máximo de resultados"),
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """
    Devuelve los nodos más similares al nodo indicado según sus embeddings FastRP.

    Funciona con cualquier label del grafo (Article, Author, Keyword, etc.).
    Solo compara y devuelve nodos del mismo label y del mismo usuario.
    """
    return await controller.find_similar_nodes(
        current_user=current_user,
        node_label=node_label,
        node_id_prop=node_id_prop,
        node_id_value=node_id_value,
        label_prop=label_prop,
        min_similarity=min_similarity,
        top_k=top_k,
    )
