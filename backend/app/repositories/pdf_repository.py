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

    async def count_documents(self, user_id: str) -> int:
        """Contar documentos asociados a un usuario"""
        count = await self.collection.count_documents({"id_user": user_id})
        return count
    
    async def update(self, pdf_id: str, update_data: dict) -> Optional[dict]:
        """Actualizar PDF por ID"""
        result = await self.collection.update_one(
            {"_id": pdf_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return None
        
        # Devolver el PDF actualizado
        return await self.collection.find_one({"_id": pdf_id})
    