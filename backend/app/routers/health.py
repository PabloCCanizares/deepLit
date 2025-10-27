"""
Ruta de health check
"""
from fastapi import APIRouter
from app.core import StandardResponse, create_response_examples
from app.config import settings

router = APIRouter(tags=["Health Check"])


@router.get(
    "/", 
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "API funcionando correctamente",
            "data": {
                "status": "ok",
                "app": "deepLit API",
                "version": "1.0.0"
            }
        },
        error_example={
            "message": "Error en el servicio",
            "error": "No se pudo conectar con la base de datos",
            "error_code": "DATABASE_CONNECTION_ERROR"
        }
    )
)
async def health_check():
    """
    Verifica que la API está funcionando correctamente.
    """
    return StandardResponse(
        success=True,
        message="API funcionando correctamente",
        data={
            "status": "ok",
            "app": settings.APP_NAME,
            "version": "1.0.0"
        }
    )

