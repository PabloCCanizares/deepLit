import os
import base64
from datetime import datetime
from app.core import AuthenticationError, ConflictError
from app.repositories import PdfRepository
from app.models import PdfUpload


class ArticleService:
    
    def __init__(self):
        self.pdf_repo = ArticleRepository()
    
    #FIXME no se si debe de venir el content en codificado o sin codificar
    # No se si despues de sacar las características se guarda desde aqui o desde upload_service

    async def extract_features(self, pdf_data: PdfUpload) -> dict:
        

        return ""
        