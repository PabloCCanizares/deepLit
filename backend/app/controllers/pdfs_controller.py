"""
Controlador de PDFs.
"""
from fastapi import Depends
from app.services.pdf_service import PdfService
from app.services.article_service import ArticleService
from app.services.extraction_service import ExtractionService
from app.services.collection_service import CollectionService
from app.ai_assistant.agents.specific_agents.pdf_processor import process_pdf
from app.ai_assistant.agents.specific_agents.knowledge_graph import create_knowledge_graph
from app.models import PdfUpload
from app.core import StandardResponse
from typing import Optional


class PdfsController:
    
    def __init__(
        self,
        pdf_service: PdfService = Depends(),
        extraction_service: ExtractionService = Depends(),
        article_service: ArticleService = Depends(),
        collection_service: CollectionService = Depends()
    ):
        # Inyección de dependencias de los 3 services
        self.pdf_service = pdf_service
        self.extraction_service = extraction_service
        self.article_service = article_service
        self.collection_service = collection_service
    
    async def upload_pdf(self, pdf_data: PdfUpload,  current_user: dict, collection_id: Optional[str] = None) -> StandardResponse:
        """
        Subir PDF y crear artículo asociado.
        """
        user_id = current_user["_id"]
        
        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={}
                )
        
        # PASO 1: Guardar PDF (PdfService)
        pdf_id, absolute_path = await self.pdf_service.save_pdf(pdf_data, user_id)
        
        # PASO 2: Procesar el PDF
        processed_info = process_pdf(absolute_path)
        _ = await self.pdf_service.save_embbedings(pdf_id=pdf_id, embbedings=processed_info["embbedings"])
        create_knowledge_graph(docs=processed_info["docs"])
        
        # PASO 4: Crear artículo con referencia al PDF (ArticleService)
        article_id = await self.article_service.create_from_pdf_features(
            pdf_id=pdf_id,
            user_id=user_id,
            features=processed_info["metadata"],
            collection_id=collection_id
        )
        
        return StandardResponse(
            success=True,
            message="PDF subido exitosamente",
            data={
                "id_pdf": pdf_id,
                "article": {
                    "_id": article_id,
                    **processed_info["metadata"]
                }
            }
        )

