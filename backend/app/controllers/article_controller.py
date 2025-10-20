"""
Controlador de autenticación
"""
from fastapi import Depends
from app.services.article_service import ArticleService
# from app.models import ArticleUpload
from app.core import StandardResponse


class ArticleController:
    
    def __init__(self, service: ArticleService = Depends()):
        self.service = service
    
    async def get_article(self, current_user: dict, article_id: str) -> StandardResponse:
        """
        Get article by ID.
        """
        article = await self.service.get_article(current_user, article_id)
        return StandardResponse(
            success=True,
            message="Artículo recuperado exitosamente",
            data=article
        )
