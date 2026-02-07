"""
Servicio de Artículos.
"""
from datetime import datetime
from app.repositories import ArticleRepository
from app.models import QueryBody
from app.core import NotFoundError, AuthorizationError
from typing import List, Dict, Optional, Any


# Campos esperados para un artículo completo con sus valores por defecto
ARTICLE_DEFAULT_FIELDS = {
    "doi": "No disponible",
    "title": "Sin título",
    "relevance_score": None,
    "year": "No disponible",
    "category": "No disponible",
    "type": "No disponible",
    "pages": "No disponible",
    "pdf_url": None,
    "landing_page_url": None,
    "keywords": [],
    "referenced_works": [],
    "related_works": [],
    "counts_by_year": [],
    "abstract": "No disponible",
    "authors": [],
    "citations": None,
    "summary": "No disponible",
    "acronym": "No disponible",
    "link": None,
    "citation": "No disponible",
    "observations": ""
}


def normalize_article(article_data: Dict) -> Dict:
    """
    Normaliza un diccionario de artículo, rellenando los campos faltantes
    con valores predeterminados.
    """
    normalized = article_data.copy()
    
    for field, default_value in ARTICLE_DEFAULT_FIELDS.items():
        if field not in normalized or normalized[field] is None:
            normalized[field] = default_value
    
    return normalized


class ArticleService:
    
    def __init__(self):
        self.article_repo = ArticleRepository()
    
    async def create_from_pdf_features(
        self,
        pdf_id: str,
        user_id: str,
        features: Dict,
        collection_id: Optional[str] = None
    ) -> str:
        """
        Crear artículo a partir de características extraídas.
        """
        # Generar ID del artículo
        article_id = f"article_{pdf_id}"
        
        # Normalizar features para rellenar campos faltantes
        normalized_features = normalize_article(features)
        
        # Preparar datos del artículo
        article_dict = {
            "_id": article_id,
            "id_user": user_id,
            "id_pdf": pdf_id,
            **normalized_features  # title, abstract, authors, year, keywords, etc.
        }

        if collection_id:
            # Aquí asignamos una lista que contiene el ID al nuevo campo "collection_ids"
            article_dict["collection_ids"] = [collection_id]

        
        # Guardar en base de datos
        result_id = await self.article_repo.create(article_dict)
                
        return result_id
    
    async def get_article_count(self, user_id: str, collection_id: Optional[str] = None) -> int:
        """
        Contar artículos del usuario.
        """
        return await self.article_repo.count_documents(user_id, collection_id)
    
    async def get_article_count_grouped_by_year(self, user_id: str, collection_id: Optional[str] = None) -> Dict[int, int]:
        """
        Obtener conteo de artículos agrupados por año.
        """
        results = await self.article_repo.count_documents_by_year(user_id, collection_id)
        
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
    
    async def get_keywords_ranking(self, user_id: str, collection_id: Optional[str] = None) -> List:
        """
        Obtener ranking de keywords como lista de tuplas [keyword, count].
        """
        results = await self.article_repo.get_keywords_aggregated(user_id, collection_id)
        
        # Convertir a formato esperado por el frontend: [[keyword, count], ...]
        keywords = []
        for item in results:
            if item["_id"] is not None:
                keywords.append([item["_id"], item["count"]])
        
        return keywords

    async def get_user_articles(self, query: QueryBody, user_id: str, collection_id: Optional[str] = None) -> Dict:
        """
        Recuperar artículos del usuario actual.
        """
        # Obtener artículos con paginación
        articles = await self.article_repo.get_user_articles(query, user_id, collection_id)
        
        # Obtener total de artículos del usuario (para metadatos de paginación)
        total = await self.article_repo.count_documents(user_id, collection_id)
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