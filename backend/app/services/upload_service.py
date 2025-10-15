"""
Servicio de autenticación
"""
from datetime import datetime
from app.core.auth import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError
from app.repositories import PdfRepository
from app.models import PdfUpload

class UploadService:
    
    def __init__(self):
        self.pdf_repo = PdfRepository()
    
    async def upload_pdf(self, pdf_data: PdfUpload, current_user: dict) -> dict:
        """
        Subir un nuevo PDF.
        """
        
        # Construir el id unico con timestamp y user id
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        #FIXME Crear un objeto ODM
        pdf_dict = {
            "_id": f"{current_user.email}_{timestamp}",
            "id_user": current_user.email, #FIXME cambiar por id
            "filename": pdf_data.file_name
        }
       
        id_pdf = await self.pdf_repo.create(pdf_dict)


        # TODO guardar el PDF en un servicio de almacenamiento

        
        #TODO Analizar el PDF y extraer el artículo (servicio externo que trabaja para este)


        #TODO Crear objeto del artículo y llamar a repo_articles.create()


        return {
            "id_pdf": id_pdf,
            #"article": article,
        }
    
