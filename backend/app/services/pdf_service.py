"""
Servicio de PDFs.
"""
import base64
from datetime import datetime
from pathlib import Path
from app.repositories import PdfRepository
from app.models import PdfUpload
from app.services import StorageService


class PdfService:
    
    def __init__(self):
        self.pdf_repo = PdfRepository()
        self.storage = StorageService()
        
    async def save_pdf(self, pdf_data: PdfUpload, user_id: str) -> str:
        """
        Guardar PDF en disco y crear registro en base de datos.
        """
        # Generar ID único
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # Quitar extensión .pdf del filename
        original_filename = pdf_data.filename
        if original_filename.lower().endswith('.pdf'):
            original_filename = original_filename[:-4]
        
        # ID único: filename_timestamp
        unique_id = f"{original_filename}_{timestamp}"
        unique_filename = f"{unique_id}.pdf"
        
        # Decodificar contenido base64
        decoded_content = base64.b64decode(pdf_data.content)
        
        # Guardar archivo en disco
        save_path = self.storage.save_file(
            content=decoded_content,
            filename=unique_filename,
            storage_location="uploads"
        )
        absolute_path = str(Path(save_path).resolve())
        
        # Crear registro en BD
        pdf_dict = {
            "_id": unique_id,
            "id_user": user_id,
            "filename": unique_filename,
            "file_path": absolute_path,
        }
        
        await self.pdf_repo.create(pdf_dict)
        
        return unique_id, absolute_path

    # async def save_embbedings(self, pdf_id: str, embbedings: list) -> dict:
    #     """
    #     Busca el PDF por id y guarda los chunks en el documento.
    #     """
    #     return await self.pdf_repo.update(pdf_id, {"embbedings": embbedings})
    
    # async def save_docs(self, pdf_id: str, docs: list) -> dict:
    #     """
    #     Busca el PDF por id y guarda los docs en el documento.
    #     """
    #     return await self.pdf_repo.update(pdf_id, {"docs": docs})

    async def get_document_count(self, user_id: str) -> int:
        """
        Contar PDFs del usuario.
        """
        return await self.pdf_repo.count_documents(user_id)
    
    async def force_delete(self, pdf_id: str) -> bool:
        """
        Eliminar registro PDF sin verificación (para rollback interno).
        """
        return await self.pdf_repo.delete(pdf_id)