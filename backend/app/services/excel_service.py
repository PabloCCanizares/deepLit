"""
Servicio de Excels.
"""
import base64
from datetime import datetime
import pandas as pd
from app.repositories import ExcelRepository
from app.models import ExcelUpload
from app.services import StorageService


class ExcelService:

    def __init__(self):
        self.excel_repo = ExcelRepository()
        self.storage = StorageService()
        # ✅ SOLO su repository, NO tiene article_repo ni article_service
    
    async def parse_excel(self, excel_data: ExcelUpload, user_id: str) -> tuple[str, list[dict]]:
        """
        Guardar Excel en disco y crear registro en base de datos.
        """
        # Generar ID único
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # Quitar extensión .pdf del filename
        original_filename = excel_data.filename
        if original_filename.lower().endswith('.xlsx'):
            original_filename = original_filename[:-5]
        
        # ID único: filename_timestamp
        unique_id = f"{original_filename}_{timestamp}"
        unique_filename = f"{unique_id}.xlsx"
        
        # Decodificar contenido base64
        decoded_content = base64.b64decode(excel_data.content)
        
        # Guardar archivo en disco
        save_path = self.storage.save_file(
            content=decoded_content,
            filename=unique_filename,
            storage_location="uploads"
        )
        
        excel_data_df = pd.read_excel(save_path)
        
        # Normalizar nombres de columnas (quitar espacios)
        excel_data_df.columns = excel_data_df.columns.str.strip()
        
        # Mapeo de columnas del Excel al formato estándar
        column_mapping = {
            # Formato Excel → Formato nuestro
            'Year': 'year',
            'Title': 'title',
            'Category': 'category',
            'Type': 'type',
            'Acronym': 'acronym',
            'Cites': 'citations',
            'Pag.': 'pages',
            'Obs': 'observations',
            'Summary': 'summary',
            'link': 'link',
            'citation': 'citation',
            'abstract': 'abstract'
        }
        
        # Renombrar columnas según el mapeo
        excel_data_df.rename(columns=column_mapping, inplace=True)
        
        # Convertir a diccionarios (mantiene todos los valores tal cual)
        articles_data = excel_data_df.to_dict('records')
        
        # Crear registro en BD
        excel_dict = {
            "_id": unique_id,
            "id_user": user_id,
            "filename": unique_filename,
            "filepath": save_path,
            "total_rows": len(articles_data)
        }
        
        result_id = await self.excel_repo.create(excel_dict)
        
        return unique_id, articles_data
    
    async def get_document_count(self, user_id: str) -> int:
        """
        Contar Excelss del usuario.
        """
        return await self.excel_repo.count_documents(user_id)
    