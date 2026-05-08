"""
Controlador del grafo de artículos.

Devuelve el grafo del usuario autenticado en formato apto para una
visualización en el dashboard.
"""
from fastapi import Depends

from app.core import StandardResponse
from app.services.article_graph_service import ArticleGraphService


class ArticleGraphController:

    def __init__(self, service: ArticleGraphService = Depends()):
        self.service = service

    async def get_user_graph(self, current_user: dict, limit: int = 250) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.get_user_graph(user_id=user_id, limit=limit)

        return StandardResponse(
            success=True,
            message="Grafo de artículos recuperado",
            data=data,
        )

    async def get_stats(self, current_user: dict) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.get_user_graph_stats(user_id=user_id)

        return StandardResponse(
            success=True,
            message="Estadísticas del grafo recuperadas",
            data=data,
        )
