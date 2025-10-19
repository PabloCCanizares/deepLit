"""
Servicio de autenticación
"""
from datetime import datetime
from app.core.auth import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError
from app.services.stats_service import StatsService

class UserService:
    
    def __init__(self):
        self.stats_service = StatsService()
    
    async def get_dashboard_stats(self, current_user: dict) -> dict:
        """
        Recuperar estadísticas del dashboard para el usuario actual.
        """
        data = await self.stats_service.get_dashboard_stats(current_user)


        return data


    # TODO GET PROFILE INFO, EDIT PROFILE ETC.