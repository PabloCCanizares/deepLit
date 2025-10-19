"""
Rutas de autenticación
"""
from fastapi import APIRouter, Depends
from app.controllers import UserController
from app.core import StandardResponse, create_response_examples
from app.core import get_current_user

router = APIRouter(prefix="/user", tags=["User"])

# ============================================
# RUTAS PÚBLICAS (sin token)
# ============================================


#FIXME modificar success_example
@router.get(
    "/stats",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "Información del usuario obtenida exitosamente",
            "data": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "usuario@example.com",
                "created_at": "2025-10-12T10:30:00Z"
            }
        },
        error_example={
            "message": "Error al obtener información del usuario",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    controller: UserController = Depends()
):
    """
    Recuperar estadísticas del dashboard para el usuario actual.
    """
    return await controller.get_dashboard_stats(current_user)