"""
Controlador de Colecciones.

Responsabilidad: Gestionar operaciones de colecciones.
"""
from fastapi import Depends, Response
from fastapi.responses import StreamingResponse, FileResponse
from typing import Optional
from app.services.collection_service import CollectionService
from app.services.storage_service import StorageService
from app.models.collection import CollectionCreate, CollectionUpdate, AddArticleToCollection
from app.core import StandardResponse, NotFoundError, AuthorizationError
import io


class CollectionsController:
    
    def __init__(self, service: CollectionService = Depends()):
        self.service = service
        self.storage = StorageService()
    
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
            color=collection_data.color,
            image=collection_data.image
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

    async def update(
        self,
        collection_id: str,
        update_data: CollectionUpdate,
        current_user: dict
    ) -> StandardResponse:
        """
        Actualizar una colección existente.
        """
        collection = await self.service.update(
            collection_id=collection_id,
            user_id=current_user["_id"],
            name=update_data.name,
            description=update_data.description,
            color=update_data.color,
            image=update_data.image
        )
        
        return StandardResponse(
            success=True,
            message="Colección actualizada exitosamente",
            data=collection
        )

    async def get_image(
        self,
        collection_id: str,
        current_user: dict
    ):
        """
        Obtener la imagen de una colección.
        """
        collection = await self.service.collection_repo.find_by_id(collection_id)
        
        if not collection:
            raise NotFoundError("Colección no encontrada")
        
        if collection.get("id_user") != current_user["_id"]:
            raise AuthorizationError("No tienes permiso para acceder a esta colección")
        
        image_url = collection.get("image_url")
        
        if not image_url:
            raise NotFoundError("La colección no tiene imagen")
        
        if not self.storage.exists(image_url, storage_location="collections"):
            raise NotFoundError("Archivo de imagen no encontrado en el servidor")
        
        file_path = self.storage.get_path(image_url, storage_location="collections")
        
        return FileResponse(
            path=file_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=3600"}
        )


    async def get_ids_from_collection(self, collection_id: str, current_user: dict) -> StandardResponse:
        """
        Obtener los IDs de los artículos en una colección.
        """
        article_ids = await self.service.get_ids_from_collection(collection_id=collection_id, user_id=current_user["_id"])
        
        return StandardResponse(
            success=True,
            message="IDs de artículos recuperados correctamente",
            data={"article_ids": article_ids}
        )