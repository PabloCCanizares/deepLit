"""
Rutas de PDFs.

Endpoints para gestionar PDFs (subir, consultar, eliminar).
"""
from fastapi import APIRouter, Depends
from app.controllers import PdfsController
from app.models import PdfUpload
from app.core import StandardResponse, create_response_examples, get_current_user

router = APIRouter(prefix="/pdfs", tags=["PDFs"])

# ============================================
# RUTAS PROTEGIDAS (requieren autenticación)
# ============================================

@router.post(
    "",  # POST /pdfs (RESTful: crear recurso)
    response_model=StandardResponse,
    summary="Subir un PDF",
    responses=create_response_examples(
        success_example={
            "message": "PDF recibido. Procesando en segundo plano...",
            "data": {
                "id_pdf": "mi_articulo_20241021120000",
                "article": {
                    "_id": "article_mi_articulo_20241021120000",
                    "title": "mi_articulo.pdf",
                    "status": "processing"
                }
            }
        },
        error_example={
            "message": "Error al subir PDF",
            "error": "El archivo no es un PDF válido",
            "error_code": "INVALID_PDF"
        }
    )
)
async def create_pdf(
    pdf_data: PdfUpload,
    current_user: dict = Depends(get_current_user),
    controller: PdfsController = Depends()
):
    """
    Subir un PDF y dejar su procesamiento en cola.
    La respuesta devuelve un artículo placeholder con status processing.
    """
    return await controller.upload_pdf(pdf_data, current_user)
