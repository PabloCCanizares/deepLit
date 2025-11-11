"""
Controlador de Colecciones.

Responsabilidad: Gestionar operaciones de colecciones.
"""
from fastapi import Depends
from app.services.collection_service import CollectionService
from app.models.collection import CollectionCreate, AddArticleToCollection
from app.core import StandardResponse


class CollectionsController:
    
    def __init__(self, service: CollectionService = Depends()):
        self.service = service
    
    async def create(
        self,
        collection_data: CollectionCreate,
        current_user: dict
    ) -> StandardResponse:
        """
        Crear una nueva colección.
        """
        collection = await self.service.create(
            user_id=current_user["_id"],
            name=collection_data.name,
            description=collection_data.description,
            color=collection_data.color
        )
        
        return StandardResponse(
            success=True,
            message="Colección creada exitosamente",
            data=collection
        )
    
    async def get_user_collections(
        self,
        current_user: dict
    ) -> StandardResponse:
        """
        Obtener todas las colecciones del usuario actual.
        """
        collections = await self.service.get_user_collections(current_user["_id"])
        
        return StandardResponse(
            success=True,
            message="Colecciones recuperadas exitosamente",
            data={
                "collections": collections,
                "total": len(collections)
            }
        )
    
    async def get_with_articles(
        self,
        collection_id: str,
        current_user: dict,
        limit: int = 100,
        offset: int = 0
    ) -> StandardResponse:
        """
        Obtener colección con sus artículos.
        """
        collection = await self.service.get_collection_with_articles(
            collection_id=collection_id,
            user_id=current_user["_id"],
            limit=limit,
            offset=offset
        )
        
        return StandardResponse(
            success=True,
            message="Colección con artículos recuperada correctamente",
            data=collection
        )
    
    async def add_article(
        self,
        collection_id: str,
        article_data: AddArticleToCollection,
        current_user: dict
    ) -> StandardResponse:
        """
        Añadir un artículo a la colección.
        """
        result = await self.service.add_article_to_collection(
            collection_id=collection_id,
            article_id=article_data.article_id,
            user_id=current_user["_id"]
        )
        
        return StandardResponse(
            success=True,
            message="Artículo añadido a la colección",
            data={"added": result}
        )
    
    async def remove_article(
        self,
        collection_id: str,
        article_id: str,
        current_user: dict
    ) -> StandardResponse:
        """
        Quitar un artículo de la colección.
        """
        result = await self.service.remove_article_from_collection(
            collection_id=collection_id,
            article_id=article_id,
            user_id=current_user["_id"]
        )
        
        return StandardResponse(
            success=True,
            message="Artículo eliminado de la colección",
            data={"removed": result}
        )

