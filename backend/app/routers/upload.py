"""
Rutas de autenticación
"""
from fastapi import APIRouter, Depends
from app.controllers import UploadController
from app.models import PdfUpload
from app.core import StandardResponse, create_response_examples
from app.core import get_current_user

router = APIRouter(prefix="/upload", tags=["Subida de archivos"])

# ============================================
# RUTAS PÚBLICAS (sin token)
# ============================================


#FIXME modificar success_example
@router.post(
    "/pdf",
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
async def upload_pdf(
    pdf_data: PdfUpload,
    current_user: dict = Depends(get_current_user),
    controller: UploadController = Depends()
):
    """
    Registrar un nuevo usuario
    
    No requiere token. Cualquiera puede registrarse.
    """
    return await controller.upload_pdf(pdf_data, current_user)

