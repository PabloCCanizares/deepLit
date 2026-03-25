import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from langchain_community.vectorstores import FAISS

from ..agents.base_agents.rag_agent import RagAgent
from app.repositories import ArticleRepository
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)
_FAISS_SCOPE_CACHE: Dict[str, Dict[str, object]] = {}
storage_service = StorageService()


def _get_article_repository() -> ArticleRepository:
    return ArticleRepository()


def _scope_key(user_id: str, collection_id: Optional[str] = None) -> str:
    return f"{user_id}:{collection_id or '__all__'}"


async def _get_allowed_article_ids(user_id: str, collection_id: Optional[str] = None) -> Set[str]:
    docs = await _get_article_repository().get_scope_article_ids(
        user_id=user_id,
        collection_id=collection_id,
    )
    return set(docs)


async def _get_article_titles(article_ids: Set[str]) -> Dict[str, str]:
    if not article_ids:
        return {}
    return await _get_article_repository().get_titles_by_ids(list(article_ids))


def _build_fingerprint(index_dirs: List) -> Tuple[Tuple[str, int, int], ...]:
    fingerprint = []
    for index_dir in sorted(index_dirs, key=lambda path: path.name):
        faiss_file = index_dir / "index.faiss"
        stat = faiss_file.stat()
        fingerprint.append((index_dir.name, int(stat.st_mtime_ns), int(stat.st_size)))
    return tuple(fingerprint)


def _collect_index_dirs(user_id: str, allowed_article_ids: Set[str]) -> List:
    user_faiss_dir = storage_service.get_directory("faiss_indexes") / str(user_id)
    if not user_faiss_dir.exists():
        return []

    valid_dirs: List[Path] = []
    for index_dir in user_faiss_dir.iterdir():
        if not index_dir.is_dir():
            continue
        if allowed_article_ids and index_dir.name not in allowed_article_ids:
            continue
        if (index_dir / "index.faiss").exists():
            valid_dirs.append(index_dir)
    return valid_dirs


def _enrich_store_metadata(store: FAISS, article_id: str, article_title: str) -> None:
    docstore = getattr(store, "docstore", None)
    docs_dict = getattr(docstore, "_dict", None)
    if not isinstance(docs_dict, dict):
        return

    for doc in docs_dict.values():
        metadata = doc.metadata or {}
        metadata["article_id"] = article_id
        metadata["article_title"] = article_title
        metadata["source"] = f"article:{article_id}"
        doc.metadata = metadata


async def load_faiss_indexes(agent: RagAgent, user_id: Optional[str], collection_id: Optional[str] = None) -> None:
    """
    Carga indices FAISS solo del alcance del usuario/coleccion.
    Estructura esperada: storage/faiss_indexes/{user_id}/{article_id}/index.faiss
    """
    if not user_id:
        agent.vector_store = None
        logger.warning("Deep researcher sin user_id: no se carga contexto.")
        return

    allowed_article_ids = await _get_allowed_article_ids(user_id=user_id, collection_id=collection_id)
    if not allowed_article_ids:
        agent.vector_store = None
        logger.info("Sin articulos para usuario=%s collection=%s", user_id, collection_id)
        return

    index_dirs = _collect_index_dirs(user_id=user_id, allowed_article_ids=allowed_article_ids)
    if not index_dirs:
        agent.vector_store = None
        logger.info("Sin indices FAISS para usuario=%s collection=%s", user_id, collection_id)
        return

    article_titles = await _get_article_titles(allowed_article_ids)

    scope_key = _scope_key(user_id=user_id, collection_id=collection_id)
    fingerprint = _build_fingerprint(index_dirs)
    cache_entry = _FAISS_SCOPE_CACHE.get(scope_key)
    if cache_entry and cache_entry.get("fingerprint") == fingerprint:
        agent.vector_store = cache_entry.get("store")
        return

    merged_store = None
    for index_dir in index_dirs:
        try:
            loaded_store = FAISS.load_local(
                str(index_dir),
                agent.embedding_model,
                allow_dangerous_deserialization=True,
            )
            article_id = index_dir.name
            _enrich_store_metadata(
                store=loaded_store,
                article_id=article_id,
                article_title=article_titles.get(article_id, article_id),
            )
            if merged_store is None:
                merged_store = loaded_store
            else:
                merged_store.merge_from(loaded_store)
        except Exception as exc:
            logger.warning("Error cargando FAISS index %s: %s", index_dir.name, exc)

    agent.vector_store = merged_store
    _FAISS_SCOPE_CACHE[scope_key] = {
        "store": merged_store,
        "fingerprint": fingerprint,
    }
