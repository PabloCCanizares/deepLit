import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from langchain_community.vectorstores import FAISS

from ..base_agents.rag_agent import RagAgent
from ..config import (
    CLIENT,
    DATABASE,
    get_deep_researcher_config,
    get_rag_strategy_config,
)
from ..prompts import DEEP_RESEARCHER_PROMPT
from ..prompts import get_prompt_spec

logger = logging.getLogger(__name__)
ARTICLES_COLLECTION = CLIENT[DATABASE]["articles"]
FAISS_INDEXES_DIR = Path(__file__).resolve().parents[4] / "storage" / "faiss_indexes"
_FAISS_SCOPE_CACHE: Dict[str, Dict[str, object]] = {}
LLM_TIMEOUT_SECONDS = 45


def deep_research(state):
    prompt_spec = get_prompt_spec("deep_researcher")
    config = get_deep_researcher_config()
    agent = RagAgent(**config, system_prompt=DEEP_RESEARCHER_PROMPT)

    user_message = state["user_message"]
    history = state.get("history", [])
    user_id = state.get("user_id")
    collection_id = state.get("collection_id")
    input_processed = f"{user_message} El historial es: {history}"

    load_faiss_indexes(agent=agent, user_id=user_id, collection_id=collection_id)
    rag = agent.retrieve(
        user_message=user_message,
        strategy=get_rag_strategy_config(),
    )

    if "NO HAY CONTEXTO DISPONIBLE" in rag or "NO SE ENCONTR" in rag:
        output = "No hay contexto suficiente para responder con profundidad. Sube o indexa articulos primero."
        new_history = agent.create_history_entry(user_message, output)
        return {
            "data": output,
            "history": new_history,
            "previous_agent": "deep_researcher",
            "next_agent": None,
            "rag_context": rag,
            "prompt_version": prompt_spec.version,
        }

    prompt_final = agent.create_prompt(message=input_processed + rag)
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(agent.invoke, prompt_final)
            output = future.result(timeout=LLM_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        logger.warning("Timeout en deep_researcher para user_id=%s", user_id)
        output = "La consulta tarda demasiado en procesarse. Intenta una pregunta mas concreta."
    new_history = agent.create_history_entry(user_message, output)

    agent.print_agent_execution(agent="DEEP RESEARCHER", input=prompt_final, output=output)

    return {
        "data": output,
        "history": new_history,
        "previous_agent": "deep_researcher",
        "next_agent": None,
        "rag_context": rag,
        "prompt_version": prompt_spec.version,
    }


def _scope_key(user_id: str, collection_id: Optional[str] = None) -> str:
    return f"{user_id}:{collection_id or '__all__'}"


def _get_allowed_article_ids(user_id: str, collection_id: Optional[str] = None) -> Set[str]:
    query: Dict = {"id_user": user_id}
    if collection_id:
        query["collection_ids"] = {"$in": [collection_id]}
    docs = ARTICLES_COLLECTION.find(query, {"_id": 1})
    return {str(doc["_id"]) for doc in docs if doc.get("_id") is not None}


def _build_fingerprint(index_dirs: List[Path]) -> Tuple[Tuple[str, int, int], ...]:
    fingerprint = []
    for index_dir in sorted(index_dirs, key=lambda path: path.name):
        faiss_file = index_dir / "index.faiss"
        stat = faiss_file.stat()
        fingerprint.append((index_dir.name, int(stat.st_mtime_ns), int(stat.st_size)))
    return tuple(fingerprint)


def _collect_index_dirs(user_id: str, allowed_article_ids: Set[str]) -> List[Path]:
    user_faiss_dir = FAISS_INDEXES_DIR / str(user_id)
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


def load_faiss_indexes(agent: RagAgent, user_id: Optional[str], collection_id: Optional[str] = None) -> None:
    """
    Carga índices FAISS solo del alcance del usuario/colección.
    Estructura esperada: storage/faiss_indexes/{user_id}/{article_id}/index.faiss
    """
    if not user_id:
        agent.vector_store = None
        logger.warning("Deep researcher sin user_id: no se carga contexto.")
        return

    allowed_article_ids = _get_allowed_article_ids(user_id=user_id, collection_id=collection_id)
    if not allowed_article_ids:
        agent.vector_store = None
        logger.info("Sin articulos para usuario=%s collection=%s", user_id, collection_id)
        return

    index_dirs = _collect_index_dirs(user_id=user_id, allowed_article_ids=allowed_article_ids)
    if not index_dirs:
        agent.vector_store = None
        logger.info("Sin indices FAISS para usuario=%s collection=%s", user_id, collection_id)
        return

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
