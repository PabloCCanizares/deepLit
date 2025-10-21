"""
Rutas de Artículos.

Endpoints para gestionar artículos.
"""
from fastapi import APIRouter, Depends
from app.controllers import ArticlesController
from app.models import ArticlesQuery, Pagination
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
    query: ArticlesQuery,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Obtener lista de artículos del usuario autenticado.
    **TODO:** Añadir más filtros cuando sea necesario (year, category, etc.)
    """
    return await controller.get_user_articles(query, current_user)

