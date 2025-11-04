"""
Controlador de Artículos.

Responsabilidad: Gestionar operaciones de artículos.
"""
from fastapi import Depends
from app.services.openalex_service import OpenAlexService
from app.models import QueryBody
from app.core import StandardResponse


class OpenAlexController:
    
    def __init__(self, service: OpenAlexService = Depends()):
        self.service = service
    
    async def get_openalex_articles(
        self,
        query: QueryBody
    ) -> StandardResponse:
        """
        Obtener artículos del usuario actual con filtros y paginación.
        """
        articles_data = await self.service.get_openalex_articles(query)
        return StandardResponse(
            success=True,
            message="Artículos recuperados exitosamente",
            data= articles_data
        )

