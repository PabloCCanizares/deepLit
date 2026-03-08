"""
Controlador de Estadísticas.

Responsabilidad: Orquestar múltiples services para obtener estadísticas.
"""
from fastapi import Depends
from app.services.pdf_service import PdfService
from app.services.article_service import ArticleService
from app.services.collection_service import CollectionService
from app.core import StandardResponse
from typing import Optional



class StatsController:
    
    def __init__(
        self,
        pdf_service: PdfService = Depends(),
        article_service: ArticleService = Depends(),
        collection_service: CollectionService = Depends()
    ):
        # Inyección de dependencias de los 3 services
        self.pdf_service = pdf_service
        self.article_service = article_service
        self.collection_service = collection_service
    
    async def get_dashboard_stats(self, current_user: dict, collection_id: Optional[str] = None) -> StandardResponse:
        """
        Obtener estadísticas del dashboard.
        """
        user_id = current_user.get("_id")

        # Si la coleccion no existe, caer a dashboard global
        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                collection_id = None

        document_count = await self.pdf_service.get_document_count(user_id)
        article_count = await self.article_service.get_article_count(user_id, collection_id)

        try:
            articles_by_year = await self.article_service.get_article_count_grouped_by_year(user_id, collection_id)
        except Exception as exc:
            print(f"Warning /stats/dashboard year aggregation failed: {exc}")
            articles_by_year = {"labels": [], "values": []}

        try:
            sorted_keywords = await self.article_service.get_keywords_ranking(user_id, collection_id)
        except Exception as exc:
            print(f"Warning /stats/dashboard keywords aggregation failed: {exc}")
            sorted_keywords = []

        return StandardResponse(
            success=True,
            message="Estadisticas obtenidas exitosamente",
            data={
                "document_count": document_count,
                "article_count": article_count,
                "labels_by_year": articles_by_year.get("labels", []),
                "values_by_year": articles_by_year.get("values", []),
                "sorted_keywords": sorted_keywords
            }
        )
