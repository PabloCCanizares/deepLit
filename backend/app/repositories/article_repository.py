"""
Repositorio de usuarios
"""
from typing import Optional
from app.database import get_database
from app.models import QueryBody
from typing import List

class ArticleRepository:
    
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.articles
    
    async def create(self, article_data: dict) -> str:
        """Crear un nuevo artículo"""
        result = await self.collection.insert_one(article_data)
        return str(result.inserted_id)
    
    async def find_by_id(self, article_id: str) -> Optional[dict]:
        """Buscar artículo por ID"""
        article = await self.collection.find_one({"_id": article_id})
        return article
    
    async def update(self, article_id: str, update_data: dict) -> Optional[dict]:
        """Actualizar artículo por ID"""
        result = await self.collection.update_one(
            {"_id": article_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return None
        
        # Devolver el artículo actualizado
        return await self.find_by_id(article_id)
    
    async def delete(self, article_id: str) -> bool:
        """Eliminar artículo por ID"""
        result = await self.collection.delete_one({"_id": article_id})
        return result.deleted_count > 0
    
    async def count_documents(self, user_id: str) -> int:
        """Contar documentos asociados a un usuario"""
        count = await self.collection.count_documents({"id_user": user_id})
        return count
    

    async def get_user_articles(self, query: QueryBody, current_user: dict) -> List[dict]:
        """Recuperar artículos del usuario actual con paginación y filtros"""
        filter_criteria = {"id_user": current_user["_id"]}

        limit = query.pagination.limit
        offset = query.pagination.offset

        filters = query.filters or {}
        # 🧩 Agregar filtros opcionales (ej. category, language, etc.)
        if filters:
            for key, value in filters.items():
                # Si quieres permitir búsquedas parciales para campos de texto:
                if isinstance(value, str):
                    filter_criteria[key] = {"$regex": value, "$options": "i"}
                else:
                    filter_criteria[key] = value

        # Proyección: solo devolver campos necesarios para la lista
        projection = {
            "_id": 1,
            "title": 1,
            "category": 1,
            "pages": 1,
            "year": 1
        }

        cursor = (
            self.collection
            .find(filter_criteria, projection)
            .skip(offset)
            .limit(limit)
        )
        
        results = await cursor.to_list(length=limit)
        return results



