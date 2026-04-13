"""
Controlador de Artí­culos.

Responsabilidad: Gestionar operaciones de artí­culos.
"""
from fastapi import Depends

from app.core import StandardResponse
from app.models import QueryBody, ArticleUpdate
from app.services.article_service import ArticleService
from app.services.collection_service import CollectionService


class ArticlesController:

    def __init__(
        self,
        service: ArticleService = Depends(),
        collection_service: CollectionService = Depends(),
    ):
        self.article_service = service
        self.collection_service = collection_service

    async def get_user_articles(
        self,
        query: QueryBody,
        current_user: dict,
    ) -> StandardResponse:
        """
        Obtener artículos del usuario actual con filtros y paginación.
        """
        user_id = current_user.get("_id")
        collection_id = query.collection_id
        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={},
                )

        articles_data = await self.article_service.get_user_articles(query, user_id, collection_id)

        return StandardResponse(
            success=True,
            message="Artí­culos recuperados exitosamente",
            data={
                "articles": articles_data["articles"],
                "total": articles_data["total"],
            },
        )

    async def get_by_id(self, article_id: str, current_user: dict) -> StandardResponse:
        """
        Obtener artí­culo por ID.
        """
        article = await self.article_service.get_by_id(article_id, current_user["_id"])

        return StandardResponse(
            success=True,
            message="Artí­culo recuperado correctamente",
            data=article,
        )

    async def get_pdf_file(self, article_id: str, current_user: dict):
        """
        Obtener el PDF asociado al artí­culo.
        """
        return await self.article_service.get_pdf_file(article_id, current_user["_id"])

    async def update(
        self,
        article_id: str,
        update_data: ArticleUpdate,
        current_user: dict,
    ) -> StandardResponse:
        """
        Actualizar artí­culo por ID.
        """
        update_dict = update_data.model_dump(exclude_unset=True)

        updated_article = await self.article_service.update(
            article_id,
            current_user["_id"],
            update_dict,
        )

        return StandardResponse(
            success=True,
            message="Artí­culo actualizado correctamente",
            data=updated_article,
        )

    async def delete(self, article_id: str, current_user: dict) -> StandardResponse:
        """
        Eliminar artí­culo por ID.
        """
        await self.article_service.delete(article_id, current_user["_id"])

        return StandardResponse(
            success=True,
            message="Artí­culo eliminado correctamente",
            data={"deleted": True},
        )

    async def get_queue(self, current_user: dict) -> StandardResponse:
        """
        Obtener artí­culos en cola de procesamiento (processing/error).
        """
        user_id = current_user.get("_id")
        queue = await self.article_service.get_queue(user_id)

        return StandardResponse(
            success=True,
            message="Cola de procesamiento recuperada",
            data={"queue": queue, "total": len(queue)},
        )

    async def get_article_status(self, article_id: str, current_user: dict) -> StandardResponse:
        """
        Obtener el status de un artí­culo especí­fico.
        """
        article = await self.article_service.get_by_id(article_id, current_user["_id"])

        return StandardResponse(
            success=True,
            message="Status del artí­culo recuperado",
            data={
                "_id": article.get("_id"),
                "status": article.get("status", "ready"),
                "title": article.get("title"),
                "error_message": article.get("error_message"),
            },
        )
