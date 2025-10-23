"""
Servicio de Artículos.
"""
from datetime import datetime
from app.repositories import ArticleRepository
from app.models import QueryBody
from typing import List, Dict


class ArticleService:
    
    def __init__(self):
        self.article_repo = ArticleRepository()
        # ✅ SOLO su repository, NO tiene pdf_repo ni extraction logic
    
    async def create_from_features(
        self,
        pdf_id: str,
        user_id: str,
        features: Dict
    ) -> str:
        """
        Crear artículo a partir de características extraídas.
        """
        # Generar ID del artículo
        article_id = f"article_{pdf_id}"
        
        # Preparar datos del artículo
        article_dict = {
            "_id": article_id,
            "id_user": user_id,
            "id_pdf": pdf_id,
            **features  # title, abstract, authors, year, keywords, etc.
        }
        
        # Guardar en base de datos
        await self.article_repo.create(article_dict)
        
        return article_id
    
    async def get_article_count(self, user_id: str) -> int:
        """
        Contar artículos del usuario.
        """
        return await self.article_repo.count_documents(user_id)
    
    async def get_user_articles(self, query: QueryBody, current_user: dict) -> Dict:
        """
        Recuperar artículos del usuario actual.
        """
        # Obtener artículos con paginación
        articles = await self.article_repo.get_user_articles(query, current_user)
        
        # Obtener total de artículos del usuario (para metadatos de paginación)
        total = await self.article_repo.count_documents(current_user.get("_id"))
        
        return {
            "articles": articles,
            "total": total
        }