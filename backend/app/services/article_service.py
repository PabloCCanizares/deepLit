"""
Servicio de Artículos.
"""
from datetime import datetime
from app.repositories import ArticleRepository
from app.models import QueryBody
from app.core import NotFoundError, AuthorizationError
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
    
    async def get_article_count_grouped_by_year(self, user_id: str) -> Dict[int, int]:
        """
        Obtener conteo de artículos agrupados por año.
        """
        results = await self.article_repo.count_documents_by_year(user_id)
        
        labels = []
        values = []
        for item in results:
            if item["_id"] is not None:
                labels.append(str(item["_id"]))
                values.append(item["count"])
        
        return {
            "labels": labels,
            "values": values
        }
    
    async def get_user_articles(self, query: QueryBody, current_user: dict) -> Dict:
        """
        Recuperar artículos del usuario actual.
        """
        # Obtener artículos con paginación
        articles = await self.article_repo.get_user_articles(query, current_user)
        
        # Obtener total de artículos del usuario (para metadatos de paginación)
        total = await self.article_repo.count_documents(current_user)
        
        return {
            "articles": articles,
            "total": total
        }
    
    async def get_by_id(self, article_id: str, user_id: str) -> Dict:
        """
        Obtener artículo por ID.
        Verifica que el artículo pertenezca al usuario.
        """
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("Artículo no encontrado")
        
        # Verificar que el artículo pertenece al usuario
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a este artículo")
        
        return article
    
    async def update(self, article_id: str, user_id: str, update_data: Dict) -> Dict:
        """
        Actualizar artículo por ID.
        Verifica que el artículo pertenezca al usuario.
        """
        # Verificar que el artículo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("Artículo no encontrado")
        
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artículo")
        
        # Actualizar
        updated_article = await self.article_repo.update(article_id, update_data)
        return updated_article
    
    async def delete(self, article_id: str, user_id: str) -> bool:
        """
        Eliminar artículo por ID.
        Verifica que el artículo pertenezca al usuario.
        """
        # Verificar que el artículo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("Artículo no encontrado")
        
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para eliminar este artículo")
        
        # Eliminar
        deleted = await self.article_repo.delete(article_id)
        return deleted