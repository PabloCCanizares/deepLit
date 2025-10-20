"""
Servicio de autenticación
"""
from datetime import datetime
from app.core.auth import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError
from app.services.pdf_service import PdfService
from app.services.article_service import ArticleService
from app.models.user import UserRegister

class StatsService:
    
    def __init__(self):
        self.pdf_service = PdfService()
        self.article_service = ArticleService()
    
    async def get_dashboard_stats(self, current_user: dict) -> dict:
        """
        Recuperar estadísticas del dashboard para el usuario actual.
        """

        # Contar el número de PDFs subidos por el usuario
        document_count = await self.pdf_service.get_document_count(current_user)


        article_count = await self.article_service.get_article_count(current_user)
        # Referencias Totales

        # Average Referencias  por Documento

        
        return {"document_count": document_count, "article_count": article_count}
