"""
Rutas de Artículos.

Endpoints para gestionar artículos.
"""
from fastapi import APIRouter, Depends
from app.controllers import ArticlesController
from app.models import QueryBody, Pagination
from app.core import StandardResponse, create_response_examples, get_current_user

router = APIRouter(prefix="/articles", tags=["Articles"])

# ============================================
# RUTAS PROTEGIDAS (requieren autenticación)
# ============================================

@router.post(
    "/search",  # POST /articles/search
    response_model=StandardResponse,
    summary="Buscar artículos del usuario",
    responses=create_response_examples(
        success_example={
            "message": "Artículos recuperados exitosamente",
            "data": [
                {
                    "_id": "article_123",
                    "title": "Título del artículo",
                    "abstract": "Resumen",
                    "year": "2024"
                }
            ]
        },
        error_example={
            "message": "Error al obtener artículos",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_user_articles(
    query: QueryBody,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Obtener lista de artículos del usuario autenticado.
    **TODO:** Añadir más filtros cuando sea necesario (year, category, etc.)
    """
    return await controller.get_user_articles(query, current_user)


@router.get(
    "/{article_id}",
    response_model=StandardResponse,
    summary="Obtener artículo por ID",
    responses=create_response_examples(
        success_example={
            "message": "Artículo recuperado correctamente",
            "data": {
                "_id": "article_123",
                "title": "Título del artículo",
                "abstract": "Resumen del artículo",
                "year": "2024",
                "authors": "Autor 1, Autor 2"
            }
        },
        error_example={
            "message": "Artículo no encontrado",
            "error": "El artículo solicitado no existe",
            "error_code": "NOT_FOUND"
        }
    )
)
async def get_article_by_id(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Obtener un artículo específico por su ID.
    Solo puede acceder el usuario propietario del artículo.
    """
    return await controller.get_by_id(article_id, current_user)


@router.put(
    "/{article_id}",
    response_model=StandardResponse,
    summary="Actualizar artículo",
    responses=create_response_examples(
        success_example={
            "message": "Artículo actualizado correctamente",
            "data": {
                "_id": "article_123",
                "title": "Título actualizado",
                "abstract": "Resumen actualizado"
            }
        },
        error_example={
            "message": "No tienes permiso para modificar este artículo",
            "error": "FORBIDDEN",
            "error_code": "PERMISSION_DENIED"
        }
    )
)
async def update_article(
    article_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Actualizar un artículo específico.
    Solo puede actualizar el usuario propietario del artículo.
    """
    return await controller.update(article_id, update_data, current_user)


@router.delete(
    "/{article_id}",
    response_model=StandardResponse,
    summary="Eliminar artículo",
    responses=create_response_examples(
        success_example={
            "message": "Artículo eliminado correctamente",
            "data": {"deleted": True}
        },
        error_example={
            "message": "No tienes permiso para eliminar este artículo",
            "error": "FORBIDDEN",
            "error_code": "PERMISSION_DENIED"
        }
    )
)
async def delete_article(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Eliminar un artículo específico.
    Solo puede eliminar el usuario propietario del artículo.
    """
    return await controller.delete(article_id, current_user)
