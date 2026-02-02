"""
Repositorio de Colecciones
"""
from typing import Optional, List
from datetime import datetime
from app.database import get_database


class CollectionRepository:
    
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.collections
        self.articles_collection = self.db.articles
    
    async def create(self, collection_data: dict) -> str:
        """Crear una nueva colección"""
        now = datetime.utcnow().isoformat()
        collection_data["created_at"] = now
        collection_data["updated_at"] = now
        
        result = await self.collection.insert_one(collection_data)
        return collection_data.get("_id") or str(result.inserted_id)
    
    async def find_by_id(self, collection_id: str) -> Optional[dict]:
        """Buscar colección por ID"""
        collection = await self.collection.find_one({"_id": collection_id})
        return collection
    
    async def find_by_user(self, user_id: str) -> List[dict]:
        """Obtener todas las colecciones de un usuario"""
        cursor = self.collection.find({"id_user": user_id})
        collections = await cursor.to_list(length=None)
        return collections
    
    async def update(self, collection_id: str, update_data: dict) -> bool:
        """Actualizar una colección existente"""
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = await self.collection.update_one(
            {"_id": collection_id},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def count_articles_in_collection(self, collection_id: str) -> int:
        """Contar artículos en una colección"""
        count = await self.articles_collection.count_documents({
            "collection_ids": collection_id
        })
        return count
    
    async def get_articles_in_collection(
        self, 
        collection_id: str, 
        limit: int = 100, 
        offset: int = 0
    ) -> List[dict]:
        """Obtener artículos de una colección con paginación"""
        cursor = (
            self.articles_collection
            .find({"collection_ids": collection_id})
            .skip(offset)
            .limit(limit)
        )
        articles = await cursor.to_list(length=limit)
        return articles
    
    async def add_article_to_collection(self, collection_id: str, article_id: str) -> bool:
        """
        Añadir un artículo a una colección.
        Usa $addToSet para evitar duplicados.
        """
        result = await self.articles_collection.update_one(
            {"_id": article_id},
            {"$addToSet": {"collection_ids": collection_id}}
        )
        return result.modified_count > 0 or result.matched_count > 0
    
    async def remove_article_from_collection(self, collection_id: str, article_id: str) -> bool:
        """
        Quitar un artículo de una colección.
        Usa $pull para eliminar el collection_id del array.
        """
        result = await self.articles_collection.update_one(
            {"_id": article_id},
            {"$pull": {"collection_ids": collection_id}}
        )
        return result.modified_count > 0
    
    async def find_by_name_and_user(self, user_id: str, collection_name: Optional[str] = None) -> Optional[dict]:
        """Buscar colección por nombre y usuario"""
        collection = await self.collection.find_one({
            "id_user": user_id,
            "name": collection_name
        })
        return collection

    async def delete(self, collection_id: str) -> bool:
        """
        Eliminar una colección.
        Nota: No elimina los artículos, solo quita el collection_id de ellos.
        """
        # Primero quitar el collection_id de todos los artículos que lo tengan
        await self.articles_collection.update_many(
            {"collection_ids": collection_id},
            {"$pull": {"collection_ids": collection_id}}
        )
        
        # Luego eliminar la colección
        result = await self.collection.delete_one({"_id": collection_id})
        return result.deleted_count > 0

    async def delete_many(self, collection_ids: List[str]) -> int:
        """
        Eliminar múltiples colecciones.
        Devuelve el número de colecciones eliminadas.
        """
        # Quitar los collection_ids de todos los artículos
        await self.articles_collection.update_many(
            {"collection_ids": {"$in": collection_ids}},
            {"$pull": {"collection_ids": {"$in": collection_ids}}}
        )
        
        # Eliminar las colecciones
        result = await self.collection.delete_many({"_id": {"$in": collection_ids}})
        return result.deleted_count

