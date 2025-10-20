"""
Controlador de autenticación
"""
from fastapi import Depends
from app.core import StandardResponse
from app.services.user_service import UserService
from app.models import ArticlesQuery


class UserController:
    
    def __init__(self, service: UserService = Depends()):
        self.service = service
    
    async def get_dashboard_stats(self, current_user: dict) -> StandardResponse:
        """
¡       Recuperar estadísticas del dashboard para el usuario actual.
        """
        user_stats = await self.service.get_dashboard_stats(current_user)
        return StandardResponse(
            success=True,
            message="Dashboard stats recuperadas exitosamente",
            data=user_stats
        )
    

    async def get_user_articles(self, query: ArticlesQuery,current_user: dict) -> StandardResponse:
        """
¡       Recuperar estadísticas del dashboard para el usuario actual.
        """
        user_articles = await self.service.get_user_articles(query, current_user)
        return StandardResponse(
            success=True,
            message="Artículos del usuario recuperados exitosamente",
            data=user_articles
        )
