"""
Rutas de autenticación
"""
from fastapi import APIRouter, Depends
from app.controllers import ArticleController
from app.core import StandardResponse, create_response_examples
from app.core import get_current_user

router = APIRouter(prefix="/article", tags=["Artículos"])

# ============================================
# RUTAS PÚBLICAS (sin token)
# ============================================


# #FIXME modificar success_example y error_example
@router.post(
    "/get",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={ 
            "message": "Archivos subidos exitosamente",
            "data": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "usuario@example.com"
            }
        },
        error_example={
            "message": "Error al registrar usuario",
            "error": "El email ya está registrado",
            "error_code": "EMAIL_ALREADY_EXISTS"
        }
    )
)
async def get_article(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ArticleController = Depends()
):
    """
    Obtener artículo por ID    
    """
    return await controller.get_article(current_user, article_id)

