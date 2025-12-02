"""
Controlador de Artículos.

Responsabilidad: Gestionar operaciones de artículos.
"""
from fastapi import Depends
from app.services.openalex_service import OpenAlexService
from app.services.collection_service import CollectionService
from app.models import QueryBody
from app.core import StandardResponse
from typing import Optional

class OpenAlexController:
    
    def __init__(self, service: OpenAlexService = Depends(), collection_service: CollectionService= Depends()):
        self.service = service
        self.collection_service = collection_service
    
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

    async def get_by_id(self, openalex_id: str) -> StandardResponse:
        """
        Obtener artículo por ID.
        """
        article = await self.service.get_by_id(openalex_id)
        
        return StandardResponse(
            success=True,
            message="Artículo de OpenAlex recuperado correctamente",
            data=article
        )
    
    async def save_openalex_article_by_id(
        self,
        openalex_id: str,
        collection_id: Optional[str],
        current_user: dict
    ) -> StandardResponse:
        """
        Guardar artículo de OpenAlex por ID en una colección específica.
        """
        user_id = current_user.get("_id")

        if collection_id:
            print("ENTRO")
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={}
                )

        saved_article_id = await self.service.save_openalex_article_by_id(openalex_id, collection_id, user_id)
        
        return StandardResponse(
            success=True,
            message="Artículo de OpenAlex guardado correctamente",
            data=saved_article_id
        )


    async def unsave_openalex_article_by_id(
        self,
        openalex_id: str,
        collection_id: Optional[str],
        current_user: dict
    ) -> StandardResponse:
        """
        Quitar el guardarado de artículo de OpenAlex por ID en una colección específica.
        Si el artículo no está guardado en más de una colección, se elimina.
        """
        user_id = current_user.get("_id")

        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={}
                )

        saved_article_id = await self.service.unsave_openalex_article_by_id(openalex_id, collection_id, user_id)
        
        return StandardResponse(
            success=True,
            message="Artículo de OpenAlex guardado correctamente",
            data=saved_article_id
        )