"""
Servicio de autenticación
"""
from datetime import datetime
from app.core.auth import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError
from app.services.stats_service import StatsService
from app.services.article_service import ArticleService
from app.models import ArticlesQuery
from typing import List

class UserService:
    
    def __init__(self):
        self.stats_service = StatsService()
        self.article_service = ArticleService()
    
    async def get_dashboard_stats(self, current_user: dict) -> dict:
        """
        Recuperar estadísticas del dashboard para el usuario actual.
        """
        data = await self.stats_service.get_dashboard_stats(current_user)
        return data


    


    async def get_user_articles(self, query: ArticlesQuery,current_user: dict) -> List[dict]:
        """
        Recuperar artículos del usuario actual.
        """
        # Lógica para obtener los artículos del usuario desde la base de datos
        # Aplicar paginación y filtros según los parámetros en 'query'
        articles = await self.article_service.get_user_articles(query, current_user)
        return articles
    





    # TODO GET PROFILE INFO, EDIT PROFILE ETC.
    