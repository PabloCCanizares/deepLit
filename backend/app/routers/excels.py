"""
Rutas de PDFs.

Endpoints para gestionar PDFs (subir, consultar, eliminar).
"""
from fastapi import APIRouter, Depends
from app.controllers import ExcelsController
from app.models import ExcelUpload
from app.core import StandardResponse, create_response_examples, get_current_user

router = APIRouter(prefix="/excels", tags=["Excel"])

# ============================================
# RUTAS PROTEGIDAS (requieren autenticación)
# ============================================

@router.post(
    "",  # POST /excels (RESTful: crear recurso)
    response_model=StandardResponse,
    summary="Subir un Excel",
    responses=create_response_examples(
        success_example={
            "message": "Excel subido exitosamente",
            "data": {
                "id_excel": "mi_articulo_20241021120000",
                "article": {
                    "_id": "article_mi_articulo_20241021120000",
                    "id_user": "user_123",
                    "id_excel": "mi_articulo_20241021120000",
                    "title": "Título extraído",
                    "abstract": "Resumen extraído",
                    "keywords": "palabras clave",
                    "year": "2024"
                }
            }
        },
        error_example={
            "message": "Error al subir Excel",
            "error": "El archivo no es un Excel válido",
            "error_code": "INVALID_EXCEL"
        }
    )
)
async def create_excel(
    excel_data: ExcelUpload,
    current_user: dict = Depends(get_current_user),
    controller: ExcelsController = Depends()
):
    """
    Subir un Excel y extraer su contenido automáticamente.
    """
    return await controller.upload_excel(excel_data, current_user)

