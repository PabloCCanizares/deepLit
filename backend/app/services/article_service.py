"""
Servicio de Artículos.
"""
import re
import shutil
from datetime import datetime
from pathlib import Path
from app.repositories import ArticleRepository
from app.models import QueryBody
from app.core import NotFoundError, AuthorizationError
from typing import List, Dict, Optional, Any


# Campos alineados con OpenAlexService.select_fields
ARTICLE_DEFAULT_FIELDS = {
    "doi": None,
    "title": None,
    "relevance_score": None,
    "year": None,
    "category": None,
    "type": None,
    "pages": None,
    "pdf_url": None,
    "landing_page_url": None,
    "keywords": [],
    "authors": [],
    "referenced_works": [],
    "related_works": [],
    "counts_by_year": [],
    "abstract": None,
}


def _normalize_year_value(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value if 1000 <= value <= 9999 else None
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        direct_match = re.fullmatch(r"\d{4}", stripped)
        if direct_match:
            return int(stripped)
        embedded_match = re.search(r"(19|20)\d{2}", stripped)
        if embedded_match:
            return int(embedded_match.group(0))
    return None


def _normalize_keywords_field(raw_keywords: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if raw_keywords is None:
        return normalized

    if isinstance(raw_keywords, str):
        for part in re.split(r"[;,]", raw_keywords):
            key = part.strip()
            if key:
                normalized.append({"key": key, "score": None})
        return normalized

    if not isinstance(raw_keywords, list):
        return normalized

    for item in raw_keywords:
        if isinstance(item, str):
            key = item.strip()
            if key:
                normalized.append({"key": key, "score": None})
            continue

        if not isinstance(item, dict):
            continue

        raw_key = item.get("key") or item.get("display_name") or item.get("name")
        key = str(raw_key).strip() if raw_key is not None else ""
        if not key:
            continue

        score = item.get("score")
        try:
            score = float(score) if score is not None else None
        except (TypeError, ValueError):
            score = None

        normalized.append({"key": key, "score": score})

    return normalized


def _normalize_string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if not isinstance(value, list):
        return []

    out: List[str] = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            out.append(text)
    return out


def _normalize_counts_by_year(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []

    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        year = _normalize_year_value(item.get("year"))
        if year is None:
            continue

        cited_by_count = item.get("cited_by_count")
        try:
            cited_by_count = int(cited_by_count) if cited_by_count is not None else 0
        except (TypeError, ValueError):
            cited_by_count = 0

        out.append({"year": year, "cited_by_count": cited_by_count})
    return out


def _normalize_authors(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    if not isinstance(value, list):
        return []

    out: List[str] = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            out.append(text)
    return out


def normalize_article(article_data: Dict) -> Dict:
    """
    Normaliza un diccionario de artículo, rellenando los campos faltantes
    con valores predeterminados.
    """
    normalized = article_data.copy()

    # Compatibilidad con campos alternativos
    if not normalized.get("title") and normalized.get("display_name"):
        normalized["title"] = normalized.get("display_name")
    if normalized.get("publication_year") is not None and normalized.get("year") is None:
        normalized["year"] = normalized.get("publication_year")
    if normalized.get("link") and not normalized.get("landing_page_url"):
        normalized["landing_page_url"] = normalized.get("link")

    # Normalizacion de tipos con formato OpenAlex
    normalized["year"] = _normalize_year_value(normalized.get("year"))
    normalized["keywords"] = _normalize_keywords_field(normalized.get("keywords"))
    normalized["authors"] = _normalize_authors(normalized.get("authors"))
    normalized["referenced_works"] = _normalize_string_list(normalized.get("referenced_works"))
    normalized["related_works"] = _normalize_string_list(normalized.get("related_works"))
    normalized["counts_by_year"] = _normalize_counts_by_year(normalized.get("counts_by_year"))

    pages_value = normalized.get("pages")
    try:
        normalized["pages"] = int(pages_value) if pages_value is not None and str(pages_value).strip() else None
    except (TypeError, ValueError):
        normalized["pages"] = None

    relevance_value = normalized.get("relevance_score")
    try:
        normalized["relevance_score"] = float(relevance_value) if relevance_value is not None and str(relevance_value).strip() else None
    except (TypeError, ValueError):
        normalized["relevance_score"] = None

    for field, default_value in ARTICLE_DEFAULT_FIELDS.items():
        if field not in normalized or normalized[field] is None:
            normalized[field] = default_value

    # Esquema final estricto: solo campos OpenAlex-aligned
    return {field: normalized.get(field) for field in ARTICLE_DEFAULT_FIELDS.keys()}


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
            **normalized_features  # title, abstract, year, keywords, etc.
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
            "year": None,
            "category": None,
            "pages": None,
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
        dashboard_docs = await self.article_repo.get_dashboard_fields(user_id, collection_id)

        counts_by_year: Dict[int, int] = {}
        for doc in dashboard_docs:
            normalized_year = self._normalize_year(doc.get("year"))
            if normalized_year is None:
                continue
            counts_by_year[normalized_year] = counts_by_year.get(normalized_year, 0) + 1

        sorted_years = sorted(counts_by_year.items(), key=lambda item: item[0])
        labels = [str(year) for year, _ in sorted_years]
        values = [count for _, count in sorted_years]

        return {
            "labels": labels,
            "values": values
        }

    async def get_keywords_ranking(self, user_id: str, collection_id: Optional[str] = None) -> List:
        """
        Obtener ranking de keywords como lista de tuplas [keyword, count].
        """
        dashboard_docs = await self.article_repo.get_dashboard_fields(user_id, collection_id)

        keyword_counts: Dict[str, int] = {}
        for doc in dashboard_docs:
            for keyword in self._extract_keywords(doc.get("keywords")):
                keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1

        sorted_keywords = sorted(
            keyword_counts.items(),
            key=lambda item: item[1],
            reverse=True
        )[:50]

        return [[keyword, count] for keyword, count in sorted_keywords]

    def _normalize_year(self, year_value: Any) -> Optional[int]:
        """
        Normaliza year a entero de 4 digitos.
        """
        if year_value is None:
            return None

        if isinstance(year_value, int):
            return year_value if 1000 <= year_value <= 9999 else None

        year_text = str(year_value).strip()
        if not year_text:
            return None

        direct_match = re.fullmatch(r"\d{4}", year_text)
        if direct_match:
            return int(year_text)

        embedded_match = re.search(r"(19|20)\d{2}", year_text)
        if embedded_match:
            return int(embedded_match.group(0))

        return None

    def _extract_keywords(self, raw_keywords: Any) -> List[str]:
        """
        Extrae keywords desde distintos formatos:
        - [{"key": "..."}], [{"display_name": "..."}]
        - ["kw1", "kw2"]
        - "kw1, kw2; kw3"
        """
        keywords: List[str] = []

        if raw_keywords is None:
            return keywords

        if isinstance(raw_keywords, str):
            for part in re.split(r"[;,]", raw_keywords):
                cleaned = part.strip().lower()
                if cleaned:
                    keywords.append(cleaned)
            return list(dict.fromkeys(keywords))

        if isinstance(raw_keywords, list):
            for item in raw_keywords:
                if isinstance(item, str):
                    cleaned = item.strip().lower()
                    if cleaned:
                        keywords.append(cleaned)
                    continue

                if isinstance(item, dict):
                    raw_value = item.get("key") or item.get("display_name") or item.get("name")
                    if raw_value is None:
                        continue
                    cleaned = str(raw_value).strip().lower()
                    if cleaned:
                        keywords.append(cleaned)

        return list(dict.fromkeys(keywords))

    async def get_user_articles(self, query: QueryBody, user_id: str, collection_id: Optional[str] = None) -> Dict:
        """
        Recuperar artÃ­culos del usuario actual.
        """
        # Obtener artÃ­culos con paginaciÃ³n
        articles = await self.article_repo.get_user_articles(query, user_id, collection_id)
        
        # Obtener total de artÃ­culos del usuario (para metadatos de paginaciÃ³n)
        total = await self.article_repo.count_documents(user_id, collection_id)
        return {
            "articles": articles,
            "total": total
        }
    
    async def get_by_id(self, article_id: str, user_id: str) -> Dict:
        """
        Obtener artÃ­culo por ID.
        Verifica que el artÃ­culo pertenezca al usuario.
        """
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("ArtÃ­culo no encontrado")
        
        # Verificar que el artÃ­culo pertenece al usuario
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a este artÃ­culo")
        
        return article
    
    async def update(self, article_id: str, user_id: str, update_data: Dict) -> Dict:
        """
        Actualizar artÃ­culo por ID.
        Verifica que el artÃ­culo pertenezca al usuario.
        """
        # Verificar que el artÃ­culo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("ArtÃ­culo no encontrado")
        
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artÃ­culo")
        
        # Solo campos alineados con esquema OpenAlex
        allowed_fields = set(ARTICLE_DEFAULT_FIELDS.keys())
        sanitized_update = {k: v for k, v in update_data.items() if k in allowed_fields}

        # Alias legacy
        if "link" in update_data and "landing_page_url" not in sanitized_update:
            sanitized_update["landing_page_url"] = update_data.get("link")
        if "publication_year" in update_data and "year" not in sanitized_update:
            sanitized_update["year"] = update_data.get("publication_year")

        if not sanitized_update:
            return article

        # Normalizar parcial sin rellenar defaults (evita pisar otros campos)
        normalized_partial = sanitized_update.copy()
        if "year" in normalized_partial:
            normalized_partial["year"] = _normalize_year_value(normalized_partial.get("year"))
        if "keywords" in normalized_partial:
            normalized_partial["keywords"] = _normalize_keywords_field(normalized_partial.get("keywords"))
        if "authors" in normalized_partial:
            normalized_partial["authors"] = _normalize_authors(normalized_partial.get("authors"))
        if "referenced_works" in normalized_partial:
            normalized_partial["referenced_works"] = _normalize_string_list(normalized_partial.get("referenced_works"))
        if "related_works" in normalized_partial:
            normalized_partial["related_works"] = _normalize_string_list(normalized_partial.get("related_works"))
        if "counts_by_year" in normalized_partial:
            normalized_partial["counts_by_year"] = _normalize_counts_by_year(normalized_partial.get("counts_by_year"))
        if "pages" in normalized_partial:
            try:
                pages_value = normalized_partial.get("pages")
                normalized_partial["pages"] = int(pages_value) if pages_value is not None and str(pages_value).strip() else None
            except (TypeError, ValueError):
                normalized_partial["pages"] = None
        if "relevance_score" in normalized_partial:
            try:
                score_value = normalized_partial.get("relevance_score")
                normalized_partial["relevance_score"] = float(score_value) if score_value is not None and str(score_value).strip() else None
            except (TypeError, ValueError):
                normalized_partial["relevance_score"] = None

        # Actualizar
        updated_article = await self.article_repo.update(article_id, normalized_partial)
        return updated_article
    
    async def get_queue(self, user_id: str) -> List[Dict]:
        """
        Obtener artÃ­culos en cola de procesamiento (status='processing' o 'error').
        Retorna lista ordenada por fecha de creaciÃ³n (mÃ¡s reciente primero).
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
        Eliminar artÃ­culo por ID, incluyendo:
        1. Registro del artÃ­culo en BD
        2. PDF del almacenamiento local (si existe)
        3. Ãndice FAISS del artÃ­culo (si existe)
        
        Verifica que el artÃ­culo pertenezca al usuario.
        """
        # Verificar que el artÃ­culo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("ArtÃ­culo no encontrado")
        
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para eliminar este artÃ­culo")
        
        # Obtener id_pdf para eliminar el PDF (fallback por convenciÃ³n article_<pdf_id>)
        pdf_id = article.get("id_pdf")
        if not pdf_id and isinstance(article_id, str) and article_id.startswith("article_"):
            pdf_id = article_id[len("article_"):]

        # Eliminar PDF del almacenamiento local si existe/estÃ¡ asociado
        if pdf_id:
            await self.pdf_service.delete_pdf_by_id(pdf_id, user_id)
        
        # Eliminar Ã­ndice FAISS si existe
        try:
            faiss_index_path = Path(__file__).resolve().parents[2] / "storage" / "faiss_indexes" / str(user_id) / article_id
            if faiss_index_path.exists():
                shutil.rmtree(faiss_index_path, ignore_errors=True)
                print(f"Ãndice FAISS eliminado: {faiss_index_path}")
        except Exception as e:
            print(f"Advertencia: Error al eliminar Ã­ndice FAISS: {e}")
            # Continuamos de todas formas
        
        # Eliminar registro del artÃ­culo en BD
        deleted = await self.article_repo.delete(article_id)
        return deleted

