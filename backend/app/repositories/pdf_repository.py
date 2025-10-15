"""
Repositorio de usuarios
"""
from typing import Optional
from app.database import get_database

class PdfRepository:
    
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.pdfs
    
    async def create(self, pdf_data: dict) -> str:
        """Crear un nuevo pdf"""
        result = await self.collection.insert_one(pdf_data)
        return str(result.inserted_id)
