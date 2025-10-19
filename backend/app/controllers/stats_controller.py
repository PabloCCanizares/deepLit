"""
Controlador de autenticación
"""
from fastapi import Depends
from app.core import StandardResponse
from app.services.stats_service import StatsService


class StatsController:
    
    def __init__(self, service: StatsService = Depends()):
        self.service = service
    
    async def get_dashboard_stats(self, current_user: dict) -> StandardResponse:
        """
¡       Recuperar estadísticas del dashboard para el usuario actual.
        """
        user = await self.service.get_dashboard_stats(current_user)
        return StandardResponse(
            success=True,
            message="Usuario registrado exitosamente",
            data=user
        )
    
