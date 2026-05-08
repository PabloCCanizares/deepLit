"""
Servicio de Artículos.
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Any

from app.core import NotFoundError, AuthorizationError
from app.models import QueryBody
from app.repositories import ArticleRepository, PdfRepository, JobRepository
from app.services.article_graph_service import ArticleGraphService
from app.services.job_service import PDF_PROCESSING_JOB

logger = logging.getLogger(__name__)


# Campos alineados con OpenAlexService.select_fields
ARTICLE_DEFAULT_FIELDS = {
    "doi": None,
    "title": None,
    "relevance_score": None,
    "year": None,
    "category": None,
    "type": None,
    "pages": None,
    "citations": None,
    "pdf_url": None,
    "landing_page_url": None,
    "summary": None,
    "observations": None,
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

    citations_value = normalized.get("citations")
    try:
        normalized["citations"] = int(citations_value) if citations_value is not None and str(citations_value).strip() else None
    except (TypeError, ValueError):
        normalized["citations"] = None

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
        self.pdf_repo = PdfRepository()
        self.job_repo = JobRepository()
        self.article_graph_service = ArticleGraphService()
        # Importar aquí para evitar circular import
        from app.services.pdf_service import PdfService
        from app.services.storage_service import StorageService
        self.pdf_service = PdfService()
        self.storage_service = StorageService()

    async def _sync_article_graph(self, article: Dict, user_id: str) -> None:
        """
        Sincroniza un artículo con el grafo de Neo4j.

        Se ejecuta en un hilo aparte para no bloquear el loop async y
        nunca propaga errores: si Neo4j no está disponible o la
        ingesta falla, sólo se registra un warning.
        """
        if not article or not user_id:
            return
        try:
            await asyncio.to_thread(
                self.article_graph_service.ingest_article,
                article,
                user_id,
            )
        except Exception as exc:
            logger.warning(
                "No se pudo sincronizar el articulo %s con el grafo: %s",
                article.get("_id") or article.get("id"),
                exc,
            )

    async def _remove_from_article_graph(self, article_id: str, user_id: str) -> None:
        """Elimina un artículo del grafo de Neo4j (best-effort)."""
        if not article_id or not user_id:
            return
        try:
            await asyncio.to_thread(
                self.article_graph_service.remove_article,
                article_id,
                user_id,
            )
        except Exception as exc:
            logger.warning(
                "No se pudo eliminar el articulo %s del grafo: %s",
                article_id,
                exc,
            )
    
    async def create_from_excel_row(
        self,
        excel_id: str,
        row_index: int,
        user_id: str,
        features: Dict,
        collection_id: Optional[str] = None
    ) -> str:
        """
        Crear artículo a partir de una fila de Excel.
        No genera ni asocia un PDF real.
        """
        article_id = f"article_{excel_id}_row{row_index}"
        normalized_features = normalize_article(features)

        article_dict = {
            "_id": article_id,
            "id_user": user_id,
            "source": "excel",
            "id_excel": excel_id,
            "import_row": row_index,
            **normalized_features,
        }

        if collection_id:
            article_dict["collection_ids"] = [collection_id]

        result_id = await self.article_repo.create(article_dict)
        await self._sync_article_graph(article_dict, user_id)
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
            "source": "pdf",
            "id_pdf": pdf_id,
            "title": filename,
            "status": "processing",
            "error_message": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
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
        article = await self.article_repo.find_by_id(article_id)
        if not article:
            raise NotFoundError("Artículo no encontrado")
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artículo")

        normalized = normalize_article(features)
        normalized["status"] = "ready"
        normalized["error_message"] = None
        normalized["updated_at"] = datetime.now(timezone.utc)
        
        updated = await self.article_repo.update(article_id, normalized)
        if updated:
            await self._sync_article_graph(updated, user_id)
        return updated

    async def mark_processing_error(
        self,
        article_id: str,
        user_id: str,
        error_message: str,
    ) -> Optional[Dict]:
        article = await self.article_repo.find_by_id(article_id)
        if not article:
            raise NotFoundError("Artículo no encontrado")
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artículo")

        return await self.article_repo.update(
            article_id,
            {
                "status": "error",
                "error_message": error_message,
                "updated_at": datetime.now(timezone.utc),
            },
        )
    
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

    async def get_type_distribution(self, user_id: str, collection_id: Optional[str] = None) -> List:
        """
        Obtener distribucion de tipos como lista de tuplas [type, count].
        """
        dashboard_docs = await self.article_repo.get_dashboard_fields(user_id, collection_id)
        type_counts: Dict[str, int] = {}
        for doc in dashboard_docs:
            doc_type = doc.get("type")
            if doc_type and isinstance(doc_type, str) and doc_type.strip():
                label = doc_type.strip()
                type_counts[label] = type_counts.get(label, 0) + 1
        sorted_types = sorted(type_counts.items(), key=lambda item: item[1], reverse=True)
        return [[t, c] for t, c in sorted_types]

    async def get_category_distribution(self, user_id: str, collection_id: Optional[str] = None) -> List:
        """
        Obtener distribucion de categorias como lista de tuplas [category, count].
        """
        dashboard_docs = await self.article_repo.get_dashboard_fields(user_id, collection_id)
        category_counts: Dict[str, int] = {}
        for doc in dashboard_docs:
            cat = doc.get("category")
            if cat and isinstance(cat, str) and cat.strip():
                label = cat.strip()
                category_counts[label] = category_counts.get(label, 0) + 1
        sorted_cats = sorted(category_counts.items(), key=lambda item: item[1], reverse=True)
        return [[c, n] for c, n in sorted_cats]

    async def get_authors_ranking(self, user_id: str, collection_id: Optional[str] = None) -> List:
        """
        Obtener ranking de autores como lista de tuplas [author, count].
        """
        dashboard_docs = await self.article_repo.get_dashboard_fields(user_id, collection_id)
        author_counts: Dict[str, int] = {}
        for doc in dashboard_docs:
            authors = doc.get("authors", [])
            if isinstance(authors, str):
                authors = [a.strip() for a in authors.split(",") if a.strip()]
            if not isinstance(authors, list):
                continue
            for author in authors:
                if isinstance(author, str) and author.strip():
                    name = author.strip()
                    author_counts[name] = author_counts.get(name, 0) + 1
        sorted_authors = sorted(author_counts.items(), key=lambda item: item[1], reverse=True)[:20]
        return [[a, c] for a, c in sorted_authors]

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
        Recuperar artí­culos del usuario actual.
        """
        # Obtener artí­culos con paginación
        articles = await self.article_repo.get_user_articles(query, user_id, collection_id)
        
        # Obtener total de artí­culos del usuario (para metadatos de paginación)
        total = await self.article_repo.count_documents(user_id, collection_id)
        return {
            "articles": articles,
            "total": total
        }
    
    async def get_by_id(self, article_id: str, user_id: str) -> Dict:
        """
        Obtener artí­culo por ID.
        Verifica que el artí­culo pertenezca al usuario.
        """
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("Artí­culo no encontrado")
        
        # Verificar que el artí­culo pertenece al usuario
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a este artí­culo")
        
        return article

    async def get_pdf_file(self, article_id: str, user_id: str) -> tuple[Path, str]:
        """
        Recuperar el PDF asociado a un artículo del usuario.
        """
        article = await self.article_repo.find_by_id(article_id)

        if not article:
            raise NotFoundError("Artículo no encontrado")

        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a este artículo")

        pdf_id = article.get("id_pdf")
        if (
            not pdf_id
            and article.get("source") != "excel"
            and isinstance(article_id, str)
            and article_id.startswith("article_")
        ):
            pdf_id = article_id[len("article_"):]

        if not pdf_id:
            raise NotFoundError("Este artículo no tiene un PDF asociado")

        pdf = await self.pdf_repo.find_by_id(pdf_id)
        if not pdf:
            raise NotFoundError("PDF no encontrado")

        if pdf.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a este PDF")

        filename = pdf.get("filename") or f"{pdf_id}.pdf"
        file_path = pdf.get("file_path")
        candidate_path = Path(file_path) if file_path else self.storage_service.get_path(filename, "uploads")

        if not candidate_path.exists():
            fallback_path = self.storage_service.get_path(filename, "uploads")
            if fallback_path.exists():
                candidate_path = fallback_path
            else:
                raise NotFoundError("El PDF asociado ya no está disponible en almacenamiento")

        return candidate_path, filename
    
    async def update(self, article_id: str, user_id: str, update_data: Dict) -> Dict:
        """
        Actualizar artí­culo por ID.
        Verifica que el artí­culo pertenezca al usuario.
        """
        # Verificar que el artí­culo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("Artí­culo no encontrado")
        
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artí­culo")
        
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
        if "citations" in normalized_partial:
            try:
                citations_value = normalized_partial.get("citations")
                normalized_partial["citations"] = int(citations_value) if citations_value is not None and str(citations_value).strip() else None
            except (TypeError, ValueError):
                normalized_partial["citations"] = None
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
        Obtener artí­culos en cola de procesamiento (status='processing' o 'error').
        Retorna lista ordenada por fecha de creación (mí¡s reciente primero).
        """
        queue_items = await self.article_repo.get_processing_articles(user_id)
        if not queue_items:
            return []

        reconciled_queue: List[Dict] = []
        for item in queue_items:
            if item.get("status") != "processing":
                reconciled_queue.append(item)
                continue

            article_id = str(item.get("_id") or "")
            latest_job = await self.job_repo.find_latest_job_by_payload_field(
                payload_field="article_id",
                payload_value=article_id,
                job_type=PDF_PROCESSING_JOB,
                user_id=user_id,
            )
            latest_job_status = latest_job.get("status") if latest_job else None

            if latest_job_status in {"queued", "processing"}:
                reconciled_queue.append(item)
                continue

            if latest_job_status == "failed":
                error_message = latest_job.get("error_message") or "El procesamiento del PDF falló."
            elif latest_job_status == "completed":
                error_message = "El job terminó, pero el artículo quedó sin actualizar."
            else:
                error_message = "No existe un job activo para este artículo; se marcó como interrumpido."

            updated_item = await self.article_repo.update(
                article_id,
                {
                    "status": "error",
                    "error_message": error_message,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            reconciled_queue.append(updated_item or {**item, "status": "error", "error_message": error_message})

        return reconciled_queue
    
    async def delete(self, article_id: str, user_id: str) -> bool:
        """
        Eliminar artí­culo por ID, incluyendo:
        1. Registro del artí­culo en BD
        2. PDF del almacenamiento local (si existe)
        3. índice FAISS del artí­culo (si existe)
        
        Verifica que el artí­culo pertenezca al usuario.
        """
        # Verificar que el artí­culo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        
        if not article:
            raise NotFoundError("Artí­culo no encontrado")
        
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para eliminar este artí­culo")
        
        # Obtener id_pdf para eliminar el PDF (fallback por convencion article_<pdf_id>)
        pdf_id = article.get("id_pdf")
        if (
            not pdf_id
            and article.get("source") != "excel"
            and isinstance(article_id, str)
            and article_id.startswith("article_")
        ):
            pdf_id = article_id[len("article_"):]

        # Eliminar PDF del almacenamiento local si existe/esta asociado
        if pdf_id:
            try:
                await self.pdf_service.delete_pdf_by_id(pdf_id, user_id)
            except NotFoundError:
                pass
        
        # Eliminar í­ndice FAISS si existe
        faiss_index_path = self.storage_service.get_faiss_article_dir(user_id=user_id, article_id=article_id)
        self.storage_service.delete_directory(faiss_index_path)
        
        # Eliminar registro del artí­culo en BD
        deleted = await self.article_repo.delete(article_id)
        if deleted:
            await self._remove_from_article_graph(article_id, user_id)
        return deleted
