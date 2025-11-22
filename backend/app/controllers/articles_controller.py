"""
Controlador de Artículos.

Responsabilidad: Gestionar operaciones de artículos.
"""
from fastapi import Depends
from app.services.article_service import ArticleService
from app.models import QueryBody, ArticleUpdate
from app.core import StandardResponse
from app.services.collection_service import CollectionService


class ArticlesController:
    
    def __init__(self,
        service: ArticleService = Depends(),
        collection_service: CollectionService = Depends()):
        self.article_service = service
        self.collection_service = collection_service
        
    async def get_user_articles(
        self,
        query: QueryBody,
        current_user: dict
    ) -> StandardResponse:
        """
        Obtener artículos del usuario actual con filtros y paginación.
        """
        user_id = current_user.get("_id")
        collection_id = query.collection_id
        #Se obtiene el id de la colección si se proporciona el nombre
        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={}
                )


        articles_data = await self.article_service.get_user_articles(query, current_user["_id"], collection_id)
     
        return StandardResponse(
            success=True,
            message="Artículos recuperados exitosamente",
            data={
                "articles": articles_data["articles"],
                "total": articles_data["total"]
            }
        )
    
    async def get_by_id(self, article_id: str, current_user: dict) -> StandardResponse:
        """
        Obtener artículo por ID.
        """
        article = await self.article_service.get_by_id(article_id, current_user["_id"])
        
        return StandardResponse(
            success=True,
            message="Artículo recuperado correctamente",
            data=article
        )
    
    async def update(self, article_id: str, update_data: ArticleUpdate, current_user: dict) -> StandardResponse:
        """
        Actualizar artículo por ID.
        """
        # Convertir modelo Pydantic a dict, excluyendo campos no establecidos
        update_dict = update_data.model_dump(exclude_unset=True)
        
        updated_article = await self.article_service.update(
            article_id, 
            current_user["_id"], 
            update_dict
        )
        
        return StandardResponse(
            success=True,
            message="Artículo actualizado correctamente",
            data=updated_article
        )
    
    async def delete(self, article_id: str, current_user: dict) -> StandardResponse:
        """
        Eliminar artículo por ID.
        """
        await self.article_service.delete(article_id, current_user["_id"])
        
        return StandardResponse(
            success=True,
            message="Artículo eliminado correctamente",
            data={"deleted": True}
        )

