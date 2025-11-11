"""
Servicio de Colecciones.
"""
from datetime import datetime
from typing import List, Dict
from app.repositories.collection_repository import CollectionRepository
from app.repositories.article_repository import ArticleRepository
from app.core import NotFoundError, AuthorizationError


class CollectionService:
    
    def __init__(self):
        self.collection_repo = CollectionRepository()
        self.article_repo = ArticleRepository()
    
    async def create(self, user_id: str, name: str, description: str = None, color: str = "#3B82F6") -> Dict:
        """
        Crear una nueva colección.
        """
        # Generar ID único
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        collection_id = f"col_{name.lower().replace(' ', '_')}_{timestamp}"
        
        collection_data = {
            "_id": collection_id,
            "id_user": user_id,
            "name": name,
            "description": description,
            "color": color
        }
        
        await self.collection_repo.create(collection_data)
        
        # El repository ya añadió created_at y updated_at al dict original
        # Añadir conteo de artículos (siempre 0 al crear)
        collection_data["article_count"] = 0
        
        return collection_data
    
    async def get_collection_with_articles(
        self, 
        collection_id: str, 
        user_id: str,
        limit: int = 100,
        offset: int = 0
    ) -> Dict:
        """
        Obtener colección con sus artículos.
        """
        # Verificar que existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        
        if not collection:
            raise NotFoundError("Colección no encontrada")
        
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a esta colección")
        
        # Obtener conteo y artículos de la colección
        article_count = await self.collection_repo.count_articles_in_collection(collection_id)
        articles = await self.collection_repo.get_articles_in_collection(
            collection_id, 
            limit=limit, 
            offset=offset
        )
        
        collection["article_count"] = article_count
        collection["articles"] = articles
        
        return collection
    
    async def get_user_collections(self, user_id: str) -> List[Dict]:
        """
        Obtener todas las colecciones de un usuario.
        """
        collections = await self.collection_repo.find_by_user(user_id)
        
        # Añadir conteo de artículos a cada colección
        for collection in collections:
            article_count = await self.collection_repo.count_articles_in_collection(
                collection["_id"]
            )
            collection["article_count"] = article_count
        
        return collections
    
    async def add_article_to_collection(
        self, 
        collection_id: str, 
        article_id: str, 
        user_id: str
    ) -> bool:
        """
        Añadir un artículo a una colección.
        Verifica que ambos pertenezcan al usuario.
        """
        # Verificar que la colección existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        if not collection:
            raise NotFoundError("Colección no encontrada")
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar esta colección")
        
        # Verificar que el artículo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        if not article:
            raise NotFoundError("Artículo no encontrado")
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artículo")
        
        # Añadir artículo a la colección
        result = await self.collection_repo.add_article_to_collection(collection_id, article_id)
        
        return result
    
    async def remove_article_from_collection(
        self, 
        collection_id: str, 
        article_id: str, 
        user_id: str
    ) -> bool:
        """
        Quitar un artículo de una colección.
        Verifica que ambos pertenezcan al usuario.
        """
        # Verificar que la colección existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        if not collection:
            raise NotFoundError("Colección no encontrada")
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar esta colección")
        
        # Verificar que el artículo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        if not article:
            raise NotFoundError("Artículo no encontrado")
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artículo")
        
        # Quitar artículo de la colección
        result = await self.collection_repo.remove_article_from_collection(collection_id, article_id)
        
        return result

