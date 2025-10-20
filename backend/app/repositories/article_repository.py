"""
Repositorio de usuarios
"""
from typing import Optional
from app.database import get_database

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
    

    