"""
Servicio de Artículos.
"""
import shutil
from datetime import datetime
from pathlib import Path
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
        # Importar aquí para evitar circular import
        from app.services.pdf_service import PdfService
        self.pdf_service = PdfService()
    
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
    
    async def create_processing_article(
        self,
        pdf_id: str,
        user_id: str,
        filename: str,
        collection_id: Optional[str] = None
    ) -> str:
        """
        Crear artículo placeholder con status='processing'.
        Se mostrará en la lista mientras se procesan los metadatos.
        """
        article_id = f"article_{pdf_id}"
        
        article_dict = {
            "_id": article_id,
            "id_user": user_id,
            "id_pdf": pdf_id,
            "title": filename,
            "status": "processing",
            "year": "No disponible",
            "category": "No disponible",
            "pages": "No disponible",
        }
        
        if collection_id:
            article_dict["collection_ids"] = [collection_id]
        
        await self.article_repo.create(article_dict)
        return article_id
    
    async def update_from_processing(
        self,
        article_id: str,
        user_id: str,
        features: Dict
    ) -> Dict:
        """
        Actualizar artículo después del procesamiento en background.
        Cambia status a 'ready' e inyecta la metadata extraída.
        """
        normalized = normalize_article(features)
        normalized["status"] = "ready"
        
        updated = await self.article_repo.update(article_id, normalized)
        return updated
    
    async def force_delete(self, article_id: str) -> bool:
        """
        Eliminar artículo sin verificación de usuario (para rollback interno).
        """
        return await self.article_repo.delete(article_id)
    
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
    
    async def get_queue(self, user_id: str) -> List[Dict]:
        """
        Obtener artículos en cola de procesamiento (status='processing' o 'error').
        Retorna lista ordenada por fecha de creación (más reciente primero).
        """
        queue_items = await self.article_repo.collection.find(
            {
                "id_user": user_id,
                "status": {"$in": ["processing", "error"]}
            }
        ).sort("created_at", -1).to_list(length=None)
        
        return queue_items if queue_items else []
    
    async def delete(self, article_id: str, user_id: str) -> bool:
        """
        Eliminar artículo por ID, incluyendo:
        1. Registro del artículo en BD
        2. PDF del almacenamiento local (si existe)
        3. Índice FAISS del artículo (si existe)
        
        Verifica que el artículo pertenezca al usuario.
        """
        # Verificar que el artículo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("Artículo no encontrado")
        
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para eliminar este artículo")
        
        # Obtener id_pdf para eliminar el PDF
        pdf_id = article.get("id_pdf")
        
        # Eliminar PDF del almacenamiento local si existe
        if pdf_id:
            try:
                await self.pdf_service.delete_pdf_by_id(pdf_id, user_id)
            except Exception as e:
                print(f"Advertencia: Error al eliminar PDF {pdf_id}: {e}")
                # Continuamos de todas formas para eliminar el artículo
        
        # Eliminar índice FAISS si existe
        try:
            faiss_index_path = Path(__file__).resolve().parents[2] / "storage" / "faiss_indexes" / str(user_id) / article_id
            if faiss_index_path.exists():
                shutil.rmtree(faiss_index_path, ignore_errors=True)
                print(f"Índice FAISS eliminado: {faiss_index_path}")
        except Exception as e:
            print(f"Advertencia: Error al eliminar índice FAISS: {e}")
            # Continuamos de todas formas
        
        # Eliminar registro del artículo en BD
        deleted = await self.article_repo.delete(article_id)
        return deleted