"""
Controlador de Artículos.

Responsabilidad: Gestionar operaciones de artículos.
"""
from fastapi import Depends
from app.services.article_service import ArticleService
from app.models import QueryBody
from app.core import StandardResponse


class ArticlesController:
    
    def __init__(self, service: ArticleService = Depends()):
        self.service = service
    
    async def get_user_articles(
        self,
        query: QueryBody,
        current_user: dict
    ) -> StandardResponse:
        """
        Obtener artículos del usuario actual con filtros y paginación.
        """
        articles_data = await self.service.get_user_articles(query, current_user["_id"])
     
        return StandardResponse(
            success=True,
            message="Artículos recuperados exitosamente",
            data={
                "articles": articles_data["articles"],
                "total": articles_data["total"]
            }
        )
    
    async def get_by_id(self, article_id: str, current_user: dict) -> StandardResponse:
        """
        Obtener artículo por ID.
        """
        article = await self.service.get_by_id(article_id, current_user["_id"])
        
        return StandardResponse(
            success=True,
            message="Artículo recuperado correctamente",
            data=article
        )
    
    async def update(self, article_id: str, update_data: dict, current_user: dict) -> StandardResponse:
        """
        Actualizar artículo por ID.
        """
        updated_article = await self.service.update(
            article_id, 
            current_user["_id"], 
            update_data
        )
        
        return StandardResponse(
            success=True,
            message="Artículo actualizado correctamente",
            data=updated_article
        )
    
    async def delete(self, article_id: str, current_user: dict) -> StandardResponse:
        """
        Eliminar artículo por ID.
        """
        await self.service.delete(article_id, current_user["_id"])
        
        return StandardResponse(
            success=True,
            message="Artículo eliminado correctamente",
            data={"deleted": True}
        )

