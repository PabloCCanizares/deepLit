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
        print("ENTRO EN CONTROLLER OPENALEX")
        articles_data = await self.service.get_openalex_articles(query)
        print("ARTICLES DATA EN CONTROLLER OPENALEX:", articles_data)
        return StandardResponse(
            success=True,
            message="Artículos recuperados exitosamente",
            data={
                "articles": articles_data["articles"],
                "total": 0
            }
        )

