"""
Servicio de autenticación
"""
from datetime import datetime
from app.core.auth import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError
from app.repositories import PdfRepository
from app.models.user import UserRegister

class StatsService:
    
    def __init__(self):
        self.pdf_repo = PdfRepository()
    
    async def get_dashboard_stats(self, current_user: dict) -> dict:
        """
        Recuperar estadísticas del dashboard para el usuario actual.
        """
        #Cuantos documentos tienen id de este usuario
        
        document_count = await self.pdf_repo.count_documents(current_user.get('_id')) #FIXME ¿Pasar todo el user o solo el id?
        
        # 3. Devolver info del usuario (sin password)
        return {
            "document_count": document_count,
        }
    
