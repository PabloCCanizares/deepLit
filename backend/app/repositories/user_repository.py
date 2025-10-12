"""
Repositorio de usuarios
"""
from typing import Optional
from app.database import get_database

class UserRepository:
    
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.users
    
    async def create(self, user_data: dict) -> str:
        """Crear un nuevo usuario"""
        result = await self.collection.insert_one(user_data)
        return str(result.inserted_id)
    
    async def find_by_email(self, email: str) -> Optional[dict]:
        """Buscar usuario por email"""
        user = await self.collection.find_one({"email": email})
        if user:
            user["_id"] = str(user["_id"])
        return user

