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

    async def compute_embeddings(self, current_user: dict) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.compute_embeddings(user_id=user_id)
        ok = data.get("success", False)
        return StandardResponse(
            success=ok,
            message="Embeddings calculados correctamente" if ok else data.get("reason", "Error"),
            data=data,
        )

    async def find_similar_nodes(
        self,
        current_user: dict,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float,
        top_k: int,
    ) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.find_similar_nodes(
            user_id=user_id,
            node_label=node_label,
            node_id_prop=node_id_prop,
            node_id_value=node_id_value,
            label_prop=label_prop,
            min_similarity=min_similarity,
            top_k=top_k,
        )
        ok = data.get("success", False)
        count = len(data.get("results", []))
        return StandardResponse(
            success=ok,
            message=f"Se encontraron {count} nodos similares" if ok else data.get("reason", "Error"),
            data=data,
        )

    async def get_embedding_status(self, current_user: dict) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.get_embedding_status(user_id=user_id)
        return StandardResponse(
            success=True,
            message="Estado de embeddings",
            data=data,
        )

    async def clear_embeddings(self, current_user: dict) -> StandardResponse:
        user_id = current_user.get("_id")
        data = self.service.clear_embeddings(user_id=user_id)
        ok = data.get("success", False)
        return StandardResponse(
            success=ok,
            message=f"Embeddings eliminados ({data.get('cleared', 0)} nodos)" if ok else data.get("reason", "Error"),
            data=data,
        )
