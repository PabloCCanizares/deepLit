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
        #TODO Revisar si hay que implementar transacciones para guardar el PDF y el artículo
        # Construir el id unico con timestamp y user id
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # Quitar la extensión .pdf del filename
        original_filename = pdf_data.filename
        if original_filename.lower().endswith('.pdf'):
            original_filename = original_filename[:-4]
        
        # Construir nombre único para el archivo
        unique_id = f"{original_filename}_{timestamp}"
        unique_filename = f"{unique_id}.pdf"
        
        #FIXME Crear un objeto ODM
        pdf_dict = {
            "_id": unique_id,
            "id_user": current_user.get('_id'),
            "filename": unique_filename
        }
       
        id_pdf = await self.pdf_repo.create(pdf_dict)


        # TODO guardar el PDF en un servicio de almacenamiento

        
        #TODO Analizar el PDF y extraer el artículo (servicio externo que trabaja para este)


        #TODO Crear objeto del artículo y llamar a repo_articles.create()


        return {
            "id_pdf": id_pdf,
            #"article": article,
        }
    
