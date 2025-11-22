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
        # Inyección de dependencias de los 2 services
        self.pdf_service = pdf_service
        self.article_service = article_service
        self.collection_service = collection_service
    
    async def get_dashboard_stats(self, current_user: dict, collection_id: Optional[str] = None) -> StandardResponse:
        """
        Obtener estadísticas del dashboard.
        """
        user_id = current_user.get("_id")
        #Se obtiene el id de la colección si se proporciona el nombre
        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={}
                )

        # PASO 1: Contar PDFs (PdfService)
        document_count = await self.pdf_service.get_document_count(user_id)
        
        # PASO 2: Contar artículos (ArticleService)
        article_count = await self.article_service.get_article_count(user_id, collection_id)


        articles_by_year = await self.article_service.get_article_count_grouped_by_year(user_id, collection_id)
        
        # TODO: Añadir más estadísticas cuando estén implementadas
        # - Referencias totales
        # - Promedio de referencias por documento
        
        return StandardResponse(
            success=True,
            message="Estadísticas obtenidas exitosamente",
            data={
                "document_count": document_count,
                "article_count": article_count,
                "labels_by_year": articles_by_year["labels"],
                "values_by_year": articles_by_year["values"]
            }
        )

