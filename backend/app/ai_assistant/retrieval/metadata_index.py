import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from langchain_core.documents import Document

from ..agents.base_agents.rag_engine import RagEngine
from app.repositories import ArticleRepository
from app.services.storage_service import StorageService
from app.services.vector_index_service import VectorIndexService

logger = logging.getLogger(__name__)
_METADATA_INDEX_CACHE: Dict[str, Dict[str, object]] = {}
storage_service = StorageService()


def _get_article_repository() -> ArticleRepository:
    return ArticleRepository()


def _scope_key(user_id: str, collection_id: Optional[str] = None) -> str:
    return f"{user_id}:{collection_id or '__all__'}"


def _scope_index_dir(user_id: str, collection_id: Optional[str] = None):
    return storage_service.get_faiss_metadata_dir(user_id=user_id, collection_id=collection_id)


def _signature_path(index_dir: Path) -> Path:
    return index_dir / "metadata_signature.json"


def _load_signature(index_dir: Path) -> Optional[str]:
    signature_file = _signature_path(index_dir)
    if not signature_file.exists():
        return None
    try:
        payload = json.loads(signature_file.read_text(encoding="utf-8"))
        return payload.get("signature")
    except Exception:
        return None


def _save_signature(index_dir: Path, signature: str, count: int) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    payload = {"signature": signature, "documents": count}
    _signature_path(index_dir).write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _serialize_article(doc: Dict) -> str:
    normalized = {
        "_id": str(doc.get("_id", "")),
        "title": doc.get("title"),
        "authors": doc.get("authors"),
        "year": doc.get("year"),
        "category": doc.get("category"),
        "type": doc.get("type"),
        "summary": doc.get("summary"),
        "abstract": doc.get("abstract"),
        "observations": doc.get("observations"),
        "keywords": doc.get("keywords", []),
        "link": doc.get("link", doc.get("pdf_url")),
        "collection_ids": doc.get("collection_ids", []),
    }
    return json.dumps(normalized, ensure_ascii=True, sort_keys=True)


async def load_metadata_documents(user_id: str, collection_id: Optional[str] = None) -> Tuple[List[Document], str]:
    """
    Carga documentos de metadata ya filtrados por usuario y opcionalmente por coleccion.
    Devuelve tambien una firma para invalidar indice cuando cambia el corpus.
    """
    mongo_docs = await _get_article_repository().get_articles_for_metadata_index(
        user_id=user_id,
        collection_id=collection_id,
    )

    documents: List[Document] = []
    signature_payload: List[str] = []

    for doc in mongo_docs:
        signature_payload.append(_serialize_article(doc))
        content = (
            f"TITULO: {doc.get('title')}\n"
            f"AUTORES: {doc.get('authors')}\n"
            f"ANO: {doc.get('year', 'Desconocido')}\n"
            f"CATEGORIA: {doc.get('category')}\n"
            f"TIPO: {doc.get('type', 'Documento')}\n"
            f"RESUMEN: {doc.get('summary', doc.get('abstract'))}\n"
            f"NOTAS DEL USUARIO: {doc.get('observations')}\n"
            f"KEYWORDS: {doc.get('keywords', [])}\n"
            f"LINK: {doc.get('link', doc.get('pdf_url'))}\n"
        )
        documents.append(
            Document(
                page_content=content,
                metadata={
                    "article_id": str(doc.get("_id", "")),
                    "article_title": doc.get("title") or str(doc.get("_id", "")),
                    "source": f"article:{doc.get('_id', '')}",
                    "page": 1,
                },
            )
        )

    signature = hashlib.sha256("\n".join(signature_payload).encode("utf-8")).hexdigest()
    return documents, signature


async def ensure_metadata_index(agent: RagEngine, user_id: str, collection_id: Optional[str] = None) -> None:
    scope_key = _scope_key(user_id=user_id, collection_id=collection_id)
    index_dir = _scope_index_dir(user_id=user_id, collection_id=collection_id)
    docs, signature = await load_metadata_documents(user_id=user_id, collection_id=collection_id)
    vector_index_service = VectorIndexService(
        embedding_model=agent.embedding_model,
        text_splitter=agent.text_splitter,
    )

    if not docs:
        agent.vector_store = None
        return

    cache_entry = _METADATA_INDEX_CACHE.get(scope_key)
    if cache_entry and cache_entry.get("signature") == signature:
        agent.vector_store = cache_entry.get("store")
        return

    signature_on_disk = _load_signature(index_dir)
    if (index_dir / "index.faiss").exists() and signature_on_disk == signature:
        agent.vector_store = vector_index_service.load_index(str(index_dir))
        _METADATA_INDEX_CACHE[scope_key] = {"signature": signature, "store": agent.vector_store}
        return

    agent.vector_store = vector_index_service.index_documents(docs=docs)
    vector_index_service.save_index(vector_store=agent.vector_store, save_path=str(index_dir))
    _save_signature(index_dir=index_dir, signature=signature, count=len(docs))
    _METADATA_INDEX_CACHE[scope_key] = {"signature": signature, "store": agent.vector_store}
    logger.info(
        "Indice metadata reconstruido para usuario=%s collection=%s docs=%d",
        user_id,
        collection_id,
        len(docs),
    )
