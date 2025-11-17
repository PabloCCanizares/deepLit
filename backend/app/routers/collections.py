"""
Router de Colecciones.

Endpoints básicos:
- POST   /collections                             - Crear nueva colección
- GET    /collections                             - Listar colecciones del usuario
- GET    /collections/{id}/articles               - Obtener artículos de una colección
- POST   /collections/{id}/articles               - Añadir artículo a colección
- DELETE /collections/{id}/articles/{article_id}  - Quitar artículo de colección
- PUT    /collections/{id}                        - Actualizar colección
- GET    /collections/{id}/image                  - Obtener imagen de colección
"""
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, Response
from typing import Optional
from app.controllers.collections_controller import CollectionsController
from app.models.collection import CollectionCreate, CollectionUpdate, AddArticleToCollection
from app.core.auth import get_current_user
from app.core.responses import StandardResponse, create_response_examples

router = APIRouter(
    prefix="/collections",
    tags=["Collections"]
)


@router.post(
    "",
    response_model=StandardResponse,
    summary="Crear colección",
    responses=create_response_examples(
        success_example={
            "message": "Colección creada exitosamente",
            "data": {
                "_id": "col_ml_20241111120000",
                "id_user": "user123",
                "name": "Machine Learning",
                "description": "Papers sobre ML",
                "color": "#3B82F6",
                "article_count": 0,
                "created_at": "2024-11-11T12:00:00Z",
                "updated_at": "2024-11-11T12:00:00Z"
            }
        }
    )
)
async def create_collection(
    collection_data: CollectionCreate,
    current_user: dict = Depends(get_current_user),
    controller: CollectionsController = Depends()
):
    """
    Crear una nueva colección con imagen opcional.
    """
    return await controller.create(collection_data, current_user)


@router.get(
    "",
    response_model=StandardResponse,
    summary="Listar colecciones del usuario",
    responses=create_response_examples(
        success_example={
            "message": "Colecciones recuperadas exitosamente",
            "data": {
                "collections": [
                    {
                        "_id": "col_ml_20241111120000",
                        "name": "Machine Learning",
                        "article_count": 15
                    }
                ],
                "total": 1
            }
        }
    )
)
async def get_user_collections(
    current_user: dict = Depends(get_current_user),
    controller: CollectionsController = Depends()
):
    """
    Obtener todas las colecciones del usuario actual.
    """
    return await controller.get_user_collections(current_user)


@router.get(
    "/{collection_id}/articles",
    response_model=StandardResponse,
    summary="Obtener colección con artículos",
    responses=create_response_examples(
        success_example={
            "message": "Colección con artículos recuperada correctamente",
            "data": {
                "_id": "col_ml_20241111120000",
                "name": "Machine Learning",
                "article_count": 2,
                "articles": [
                    {"_id": "article_1", "title": "Paper 1"},
                    {"_id": "article_2", "title": "Paper 2"}
                ]
            }
        }
    )
)
async def get_collection_with_articles(
    collection_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    controller: CollectionsController = Depends()
):
    """
    Obtener colección con sus artículos (con paginación).
    """
    return await controller.get_with_articles(
        collection_id=collection_id,
        current_user=current_user,
        limit=limit,
        offset=offset
    )


@router.post(
    "/{collection_id}/articles",
    response_model=StandardResponse,
    summary="Añadir artículo a colección",
    responses=create_response_examples(
        success_example={
            "message": "Artículo añadido a la colección",
            "data": {"added": True}
        }
    )
)
async def add_article_to_collection(
    collection_id: str,
    article_data: AddArticleToCollection,
    current_user: dict = Depends(get_current_user),
    controller: CollectionsController = Depends()
):
    """
    Añadir un artículo a la colección.
    """
    return await controller.add_article(collection_id, article_data, current_user)


@router.delete(
    "/{collection_id}/articles/{article_id}",
    response_model=StandardResponse,
    summary="Quitar artículo de colección",
    responses=create_response_examples(
        success_example={
            "message": "Artículo eliminado de la colección",
            "data": {"removed": True}
        }
    )
)
async def remove_article_from_collection(
    collection_id: str,
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: CollectionsController = Depends()
):
    """
    Quitar un artículo de la colección.
    """
    return await controller.remove_article(collection_id, article_id, current_user)


@router.put(
    "/{collection_id}",
    response_model=StandardResponse,
    summary="Actualizar colección",
    responses=create_response_examples(
        success_example={
            "message": "Colección actualizada exitosamente",
            "data": {
                "_id": "col_ml_20241111120000",
                "name": "Machine Learning Updated",
                "description": "Papers sobre ML y Deep Learning"
            }
        }
    )
)
async def update_collection(
    collection_id: str,
    update_data: CollectionUpdate,
    current_user: dict = Depends(get_current_user),
    controller: CollectionsController = Depends()
):
    """
    Actualizar una colección existente (nombre, descripción, color, imagen).
    """
    return await controller.update(collection_id, update_data, current_user)


@router.get(
    "/{collection_id}/image",
    summary="Obtener imagen de colección",
    response_class=Response,
    responses={
        200: {"description": "Imagen de la colección"},
        404: {"description": "Imagen no encontrada"}
    }
)
async def get_collection_image(
    collection_id: str,
    current_user: dict = Depends(get_current_user),
    controller: CollectionsController = Depends()
):
    """
    Obtener la imagen de una colección.
    """
    return await controller.get_image(collection_id, current_user)

