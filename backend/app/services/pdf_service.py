"""
Servicio de upload de PDFs
"""
import base64
from datetime import datetime
from app.repositories import PdfRepository, ArticleRepository
from app.models import PdfUpload
from app.services import StorageService
from app.services.article_service import ArticleService


class PdfService:
    
    def __init__(self):
        self.pdf_repo = PdfRepository()
        self.article_repo = ArticleRepository()
        self.storage = StorageService()
        self.article_service = ArticleService()
    
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
        
        id_user = current_user.get('_id')

        #FIXME Crear un objeto ODM
        pdf_dict = {
            "_id": unique_id,
            "id_user": id_user,
            "filename": unique_filename
        }
       
        id_pdf = await self.pdf_repo.create(pdf_dict)

        # Guardar el PDF usando el servicio de almacenamiento
        pdf_data.filename = unique_filename  # Actualizar el nombre del archivo en el objeto
        decoded_content = base64.b64decode(pdf_data.content)
        
        # Usar el servicio centralizado - no hay que preocuparse de crear directorios
        save_path = self.storage.save_file(
            content=decoded_content,
            filename=unique_filename,
            storage_location="uploads"  # PDFs permanentes
        )
         
        #TODO Analizar el PDF y extraer el artículo (servicio externo que trabaja para este)
        article_features = await self.article_service.extract_pdf_features(decoded_content)


            #FIXME decidir si es la mejor forma de crear el id del artículo
        id_articulo = f"article_{unique_id}"


            #FIXME Asignar temática real - Por parametro o llamando al user de alguna manera
        #id_tematica = "default_topic"  

        #FIXME Crear objeto del artículo y llamar a repo_articles.create()
        article_dict_ids = {
            "_id": id_articulo,
            "id_user": id_user,
            "id_pdf": id_pdf,
        }
        #FIXME "id_tematica": id_tematica,

        article_dict = {**article_dict_ids, **article_features}

        id_article = await self.article_repo.create(article_dict)

        return {
            "id_pdf": id_pdf,
            "article": article_dict,
        }
    

    async def get_document_count(self, current_user: dict) -> dict:
        """
        Recuperar estadísticas del dashboard para el usuario actual.
        """
        #Cuantos documentos tienen id de este usuario
        
        document_count = await self.pdf_repo.count_documents(current_user.get('_id')) #FIXME ¿Pasar todo el user o solo el id?
        
        # 3. Devolver info del usuario (sin password)
        return document_count
    