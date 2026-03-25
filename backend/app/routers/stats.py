"""
Rutas de Estadísticas.

Endpoints para obtener estadísticas del usuario.
"""
from fastapi import APIRouter, Depends
from app.controllers import StatsController
from app.core import StandardResponse, create_response_examples, get_current_user
from typing import Optional


router = APIRouter(prefix="/stats", tags=["Stats"])

# ============================================
# RUTAS PROTEGIDAS (requieren autenticación)
# ============================================

@router.get(
    "/dashboard",
    response_model=StandardResponse,
    summary="Obtener estadísticas del dashboard",
    responses=create_response_examples(
        success_example={
            "message": "Estadísticas obtenidas exitosamente",
            "data": {
                "document_count": 15,
                "article_count": 15
            }
        },
        error_example={
            "message": "Error al obtener estadísticas",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_dashboard_stats(
    collection_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    controller: StatsController = Depends()
):
    """
    Obtener estadísticas del dashboard del usuario autenticado.
    """
    return await controller.get_dashboard_stats(current_user, collection_id)
