"""
Controlador de Artículos.

Responsabilidad: Gestionar operaciones de artículos.
"""

from typing import Optional

from fastapi import Depends

from app.core import AuthorizationError, StandardResponse
from app.models import QueryBody
from app.services.collection_service import CollectionService
from app.services.openalex_service import OpenAlexService
from app.services.research_intelligence_export_service import ResearchIntelligenceExportService


class OpenAlexController:
    def __init__(
        self,
        service: OpenAlexService = Depends(),
        collection_service: CollectionService = Depends(),
    ):
        self.service = service
        self.collection_service = collection_service
        self.research_intelligence_export = ResearchIntelligenceExportService()

    @staticmethod
    def _user_id(current_user: dict) -> str:
        user_id = current_user.get("_id")
        if user_id is None:
            raise AuthorizationError("Usuario autenticado sin identidad estable")
        return str(user_id)

    async def get_openalex_articles(self, query: QueryBody) -> StandardResponse:
        """Obtener artículos del usuario actual con filtros y paginación."""
        articles_data = await self.service.get_openalex_articles(query)
        return StandardResponse(
            success=True,
            message="Artículos recuperados exitosamente",
            data=articles_data,
        )

    async def get_by_id(self, openalex_id: str) -> StandardResponse:
        """Obtener artículo por ID."""
        article = await self.service.get_by_id(openalex_id)
        return StandardResponse(
            success=True,
            message="Artículo de OpenAlex recuperado correctamente",
            data=article,
        )

    async def save_openalex_article_by_id(
        self,
        openalex_id: str,
        collection_id: Optional[str],
        current_user: dict,
    ) -> StandardResponse:
        """Guardar un artículo y publicar una observación tenant-scoped del work."""
        user_id = self._user_id(current_user)

        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={},
                )

        saved_article_id = await self.service.save_openalex_article_by_id(
            openalex_id, collection_id, user_id
        )
        await self.research_intelligence_export.capture_article(
            user_id=user_id,
            source_object_id=str(saved_article_id),
        )

        return StandardResponse(
            success=True,
            message="Artículo de OpenAlex guardado correctamente",
            data=saved_article_id,
        )

    async def unsave_openalex_article_by_id(
        self,
        openalex_id: str,
        collection_id: Optional[str],
        current_user: dict,
    ) -> StandardResponse:
        """Quitar el guardado y refrescar o retraer el work en el export provider."""
        user_id = self._user_id(current_user)

        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={},
                )

        result = await self.service.unsave_openalex_article_by_id(
            openalex_id, collection_id, user_id
        )
        await self.research_intelligence_export.capture_or_retract_article(
            user_id=user_id,
            source_object_id=str(openalex_id),
        )

        return StandardResponse(
            success=True,
            message="Artículo de OpenAlex actualizado correctamente",
            data=result,
        )
