"""
Controlador de PDFs.
"""
import base64
from fastapi import Depends
from app.services.pdf_service import PdfService
from app.services.article_service import ArticleService
from app.services.extraction_service import ExtractionService
from app.models import PdfUpload
from app.core import StandardResponse


class PdfsController:
    
    def __init__(
        self,
        pdf_service: PdfService = Depends(),
        extraction_service: ExtractionService = Depends(),
        article_service: ArticleService = Depends()
    ):
        # Inyección de dependencias de los 3 services
        self.pdf_service = pdf_service
        self.extraction_service = extraction_service
        self.article_service = article_service
    
    async def upload_pdf(self, pdf_data: PdfUpload, current_user: dict) -> StandardResponse:
        """
        Subir PDF y crear artículo asociado.
        """
        user_id = current_user.get("_id")
        
        # PASO 1: Guardar PDF (PdfService)
        pdf_id = await self.pdf_service.save_pdf(pdf_data, user_id)
        
        # PASO 2: Extraer características (ExtractionService)
        pdf_bytes = base64.b64decode(pdf_data.content)
        features = await self.extraction_service.extract_features(pdf_bytes)
        
        # PASO 3: Crear artículo con referencia al PDF (ArticleService)
        article_id = await self.article_service.create_from_features(
            pdf_id=pdf_id,
            user_id=user_id,
            features=features
        )
        
        return StandardResponse(
            success=True,
            message="PDF subido exitosamente",
            data={
                "id_pdf": pdf_id,
                "article": {
                    "_id": article_id,
                    **features
                }
            }
        )

