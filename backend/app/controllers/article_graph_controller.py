"""Controlador del grafo de artículos."""
from typing import Dict, Optional

from fastapi import BackgroundTasks, Depends

from app.ai_assistant.knowledge_graph.schema import KG_NODE_TYPES
from app.core import StandardResponse
from app.services.article_graph_service import ArticleGraphService


class ArticleGraphController:
    """Adaptador entre los endpoints y :class:`ArticleGraphService`."""

    def __init__(self, service: ArticleGraphService = Depends()):
        self.service = service

    async def get_expansion_schema(self, current_user: dict) -> StandardResponse:
        """Devuelve los tipos de nodo permitidos y un límite por defecto por tipo."""
        return StandardResponse(
            success=True,
            message="Esquema de expansión",
            data={
                "node_types": list(KG_NODE_TYPES),
                "default_per_type": 5,
                "max_per_type": 50,
            },
        )

    async def get_user_graph(self, current_user: dict, limit: int = 250) -> StandardResponse:
        """Devuelve el grafo del usuario para visualización."""
        user_id = current_user.get("_id")
        return StandardResponse(
            success=True,
            message="Grafo de artículos recuperado",
            data=self.service.get_user_graph(user_id=user_id, limit=limit),
        )

    async def get_stats(self, current_user: dict) -> StandardResponse:
        """Devuelve un resumen de cardinalidad del grafo."""
        user_id = current_user.get("_id")
        return StandardResponse(
            success=True,
            message="Estadísticas del grafo recuperadas",
            data=self.service.get_user_graph_stats(user_id=user_id),
        )

    async def compute_embeddings(self, current_user: dict) -> StandardResponse:
        """Lanza el cálculo de embeddings FastRP/semánticos para el usuario."""
        user_id = current_user.get("_id")
        data = self.service.compute_embeddings(user_id=user_id)
        success = bool(data.get("success"))
        return StandardResponse(
            success=success,
            message="Embeddings calculados correctamente" if success else data.get("reason", "Error"),
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
        """Devuelve nodos similares por coseno al nodo solicitado."""
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
        success = bool(data.get("success"))
        count = len(data.get("results", []))
        return StandardResponse(
            success=success,
            message=f"Se encontraron {count} nodos similares" if success else data.get("reason", "Error"),
            data=data,
        )

    async def get_embedding_status(self, current_user: dict) -> StandardResponse:
        """Devuelve cuántos nodos tienen embedding calculado."""
        user_id = current_user.get("_id")
        return StandardResponse(
            success=True,
            message="Estado de embeddings",
            data=self.service.get_embedding_status(user_id=user_id),
        )

    async def clear_embeddings(self, current_user: dict) -> StandardResponse:
        """Borra los embeddings de todos los nodos del usuario."""
        user_id = current_user.get("_id")
        data = self.service.clear_embeddings(user_id=user_id)
        success = bool(data.get("success"))
        return StandardResponse(
            success=success,
            message=(
                f"Embeddings eliminados ({data.get('cleared', 0)} nodos)"
                if success else data.get("reason", "Error")
            ),
            data=data,
        )

    async def start_expansion(
        self,
        current_user: dict,
        background_tasks: BackgroundTasks,
        type_limits: Optional[Dict[str, int]] = None,
    ) -> StandardResponse:
        """Lanza la expansión semántica del grafo en segundo plano.

        ``type_limits`` es un diccionario opcional ``{tipo_nodo: max}`` que
        restringe cuántos nodos de cada tipo puede generar el LLM por artículo.
        """
        user_id = str(current_user.get("_id"))
        status = self.service.get_expansion_status(user_id)
        if status.get("status") == "running":
            return StandardResponse(
                success=False,
                message="Ya hay una expansión en curso",
                data=status,
            )
        sanitized_limits = self._sanitize_type_limits(type_limits)
        background_tasks.add_task(
            self.service.expand_articles, user_id, sanitized_limits,
        )
        return StandardResponse(
            success=True,
            message="Expansión semántica iniciada",
            data={
                "status": "running", "total": 0, "current": 0, "article": "",
                "type_limits": sanitized_limits,
            },
        )

    @staticmethod
    def _sanitize_type_limits(
        type_limits: Optional[Dict[str, int]],
    ) -> Dict[str, int]:
        """Filtra y limita los valores recibidos del cliente."""
        if not type_limits:
            return {}
        clean: Dict[str, int] = {}
        for node_type in KG_NODE_TYPES:
            raw = type_limits.get(node_type)
            if raw is None:
                continue
            try:
                value = int(raw)
            except (TypeError, ValueError):
                continue
            clean[node_type] = max(0, min(50, value))
        return clean

    async def get_expansion_status(self, current_user: dict) -> StandardResponse:
        """Devuelve el estado actual y progreso de la expansión semántica."""
        user_id = str(current_user.get("_id"))
        return StandardResponse(
            success=True,
            message="Estado de expansión",
            data=self.service.get_expansion_status(user_id),
        )

    async def diagnose_expansion(self, current_user: dict) -> StandardResponse:
        """Diagnóstico paso a paso del pipeline de expansión semántica."""
        from app.services.knowledge_graph_service import KnowledgeGraphService
        kg = KnowledgeGraphService()
        try:
            report = await __import__("asyncio").to_thread(kg.diagnose)
        finally:
            kg.close()
        return StandardResponse(success=True, message="Diagnóstico completado", data=report)

