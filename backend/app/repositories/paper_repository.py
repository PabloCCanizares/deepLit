"""
Repositorio de Papers.
"""
from typing import Optional, List
from app.database import get_database


class PaperRepository:

    def __init__(self):
        self.db = get_database()
        self.collection = self.db.papers

    async def create(self, paper_data: dict) -> str:
        """Crear un nuevo paper"""
        result = await self.collection.insert_one(paper_data)
        return paper_data.get("_id") or str(result.inserted_id)

    async def find_by_id(self, paper_id: str) -> Optional[dict]:
        """Buscar paper por ID"""
        return await self.collection.find_one({"_id": paper_id})

    async def find_by_collection(self, collection_id: str, user_id: str) -> List[dict]:
        """Obtener papers de una colección del usuario"""
        cursor = self.collection.find({
            "collection_id": collection_id,
            "id_user": user_id,
        }).sort("created_at", -1)
        return await cursor.to_list(length=None)

    async def find_by_user(self, user_id: str) -> List[dict]:
        """Obtener todos los papers de un usuario"""
        cursor = self.collection.find({"id_user": user_id}).sort("created_at", -1)
        return await cursor.to_list(length=None)

    async def update(self, paper_id: str, update_data: dict) -> Optional[dict]:
        """Actualizar paper por ID"""
        result = await self.collection.update_one(
            {"_id": paper_id},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            return None
        return await self.collection.find_one({"_id": paper_id})

    async def delete(self, paper_id: str) -> bool:
        """Eliminar un paper por ID"""
        result = await self.collection.delete_one({"_id": paper_id})
        return result.deleted_count > 0

    async def delete_by_collection(self, collection_id: str) -> int:
        """Eliminar todos los papers de una colección"""
        result = await self.collection.delete_many({"collection_id": collection_id})
        return result.deleted_count

    async def count_by_collection(self, collection_id: str, user_id: str) -> int:
        """Contar papers en una colección"""
        return await self.collection.count_documents({
            "collection_id": collection_id,
            "id_user": user_id,
        })
