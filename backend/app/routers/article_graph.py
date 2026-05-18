"""Rutas del grafo de artículos."""
from typing import Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field

from app.controllers.article_graph_controller import ArticleGraphController
from app.core import StandardResponse, create_response_examples, get_current_user


router = APIRouter(prefix="/article-graph", tags=["Article Graph"])


class ExpansionRequest(BaseModel):
    """Configuración opcional para la expansión semántica."""

    type_limits: Optional[Dict[str, int]] = Field(
        default=None,
        description=(
            "Diccionario opcional ``{tipo_nodo: máximo}`` que indica cuántas "
            "entidades de cada tipo puede generar el LLM como máximo por "
            "artículo. Si se omite o se deja vacío, no se aplican límites."
        ),
    )


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
                    "articles": 0, "authors": 0, "keywords": 0,
                    "categories": 0, "types": 0, "relationships": 0,
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
    """Devuelve nodos y aristas (no dirigidas) del grafo del usuario."""
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
    """Proyecta el grafo, ejecuta FastRP y persiste los vectores en Neo4j."""
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
    """Devuelve cuántos nodos tienen embeddings calculados."""
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
    """Devuelve los nodos del mismo label más similares al nodo indicado."""
    return await controller.find_similar_nodes(
        current_user=current_user,
        node_label=node_label,
        node_id_prop=node_id_prop,
        node_id_value=node_id_value,
        label_prop=label_prop,
        min_similarity=min_similarity,
        top_k=top_k,
    )


@router.get(
    "/expand/schema",
    response_model=StandardResponse,
    summary="Tipos de nodo válidos para la expansión semántica",
)
async def get_expansion_schema(
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Devuelve los tipos de nodo permitidos y un máximo recomendado por tipo."""
    return await controller.get_expansion_schema(current_user=current_user)


@router.post(
    "/expand",
    response_model=StandardResponse,
    summary="Iniciar expansión semántica del grafo",
)
async def start_expansion(
    background_tasks: BackgroundTasks,
    body: ExpansionRequest = ExpansionRequest(),
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Lanza la expansión semántica del KG (LLM) en segundo plano.

    Acepta opcionalmente un cuerpo JSON con ``type_limits`` para indicar el
    número máximo de nodos de cada tipo que el LLM debe generar por artículo.
    """
    return await controller.start_expansion(
        current_user=current_user,
        background_tasks=background_tasks,
        type_limits=body.type_limits,
    )


@router.get(
    "/expand/status",
    response_model=StandardResponse,
    summary="Estado de la expansión semántica",
)
async def get_expansion_status(
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Devuelve estado (idle/running/done/error) y progreso de la expansión."""
    return await controller.get_expansion_status(current_user=current_user)


@router.get(
    "/expand/diagnose",
    response_model=StandardResponse,
    summary="Diagnóstico del pipeline de expansión semántica",
)
async def diagnose_expansion(
    current_user: dict = Depends(get_current_user),
    controller: ArticleGraphController = Depends(),
):
    """Verifica Neo4j (langchain), configuración del LLM y hace una extracción de prueba."""
    return await controller.diagnose_expansion(current_user=current_user)

