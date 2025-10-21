"""
Controlador de Artículos.

Responsabilidad: Gestionar operaciones de artículos.
"""
from fastapi import Depends
from app.services.article_service import ArticleService
from app.models import ArticlesQuery
from app.core import StandardResponse


class ArticlesController:
    
    def __init__(self, service: ArticleService = Depends()):
        self.service = service
    
    async def get_user_articles(
        self,
        query: ArticlesQuery,
        current_user: dict
    ) -> StandardResponse:
        """
        Obtener artículos del usuario actual con filtros y paginación.
        """
        articles_data = await self.service.get_user_articles(query, current_user)
     
        return StandardResponse(
            success=True,
            message="Artículos recuperados exitosamente",
            data={
                "articles": articles_data["articles"],
                "total": articles_data["total"]
            }
        )

