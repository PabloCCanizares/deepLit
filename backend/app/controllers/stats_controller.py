"""
Controlador de Estadísticas.

Responsabilidad: Orquestar múltiples services para obtener estadísticas.
"""
from fastapi import Depends
from app.services.pdf_service import PdfService
from app.services.article_service import ArticleService
from app.core import StandardResponse


class StatsController:
    
    def __init__(
        self,
        pdf_service: PdfService = Depends(),
        article_service: ArticleService = Depends()
    ):
        # Inyección de dependencias de los 2 services
        self.pdf_service = pdf_service
        self.article_service = article_service
    
    async def get_dashboard_stats(self, current_user: dict) -> StandardResponse:
        """
        Obtener estadísticas del dashboard.
        """
        user_id = current_user.get("_id")
        
        # PASO 1: Contar PDFs (PdfService)
        document_count = await self.pdf_service.get_document_count(user_id)
        
        # PASO 2: Contar artículos (ArticleService)
        article_count = await self.article_service.get_article_count(user_id)
        
        # TODO: Añadir más estadísticas cuando estén implementadas
        # - Referencias totales
        # - Promedio de referencias por documento
        
        return StandardResponse(
            success=True,
            message="Estadísticas obtenidas exitosamente",
            data={
                "document_count": document_count,
                "article_count": article_count
            }
        )

