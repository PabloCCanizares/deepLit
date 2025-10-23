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

        cursor = (
            self.collection
            .find(filter_criteria)
            .skip(offset)
            .limit(limit)
        )
        
        results = await cursor.to_list(length=limit)
        return results



