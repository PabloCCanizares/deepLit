"""
Repositorio de excels
"""
from typing import Optional
from app.database import get_database

class ExcelRepository:
    
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.pdfs
    
    async def create(self, excel_data: dict) -> str:
        """Crear un nuevo excel"""
        result = await self.collection.insert_one(excel_data)
        # Si usamos _id personalizado, inserted_id será ese _id
        # Si MongoDB genera el _id, usamos result.inserted_id
        return excel_data.get("_id") or str(result.inserted_id)

    async def count_documents(self, user_id: str) -> int:
        """Contar documentos asociados a un usuario"""
        count = await self.collection.count_documents({"id_user": user_id})
        return count
    
    async def update(self, excel_id: str, update_data: dict) -> Optional[dict]:
        """Actualizar Excel por ID"""
        result = await self.collection.update_one(
            {"_id": excel_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return None
        
        # Devolver el Excel actualizado
        return await self.collection.find_one({"_id": excel_id})
    
    async def find_by_id(self, excel_id: str) -> Optional[dict]:
        """Buscar Excel por ID"""
        return await self.collection.find_one({"_id": excel_id})
    