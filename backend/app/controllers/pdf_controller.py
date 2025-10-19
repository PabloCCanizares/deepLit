"""
Controlador de autenticación
"""
from fastapi import Depends
from app.services.pdf_service import PdfService
from app.models import PdfUpload
from app.core import StandardResponse


class PdfController:
    
    def __init__(self, service: PdfService = Depends()):
        self.service = service
    
    async def upload_pdf(self, pdf_data: PdfUpload, current_user: dict) -> StandardResponse:
        """
        Registrar nuevo usuario.
        
        Si el email ya existe, el service lanza ConflictError.
        """
        pdf = await self.service.upload_pdf(pdf_data, current_user)
        return StandardResponse(
            success=True,
            message="Pdf subido exitosamente",
            data=pdf
        )
