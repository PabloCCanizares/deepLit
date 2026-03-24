import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from langchain_core.documents import Document

from ..base_agents.rag_agent import RagAgent
from ..config import (
    CLIENT,
    DATABASE,
    get_metadata_config,
    get_rag_strategy_config,
)
from ..prompts import METADATA_RESEARCHER
from ..prompts import get_prompt_spec

logger = logging.getLogger(__name__)
ARTICLES_COLLECTION = CLIENT[DATABASE]["articles"]
METADATA_INDEXES_DIR = Path(__file__).resolve().parents[4] / "storage" / "faiss_metadata"
_METADATA_INDEX_CACHE: Dict[str, Dict[str, object]] = {}


def _build_prompt_input(user_message: str, history, rag_context: str) -> str:
    return (
        f"Pregunta del usuario: {user_message}\n"
        f"Historial relevante: {history}\n\n"
        f"{rag_context}"
    )


def metadata_research(state):
    prompt_spec = get_prompt_spec("metadata_researcher")
    config = get_metadata_config()
    agent = RagAgent(**config, system_prompt=METADATA_RESEARCHER)

    user_message = state["user_message"]
    history = state.get("history", [])
    user_id = state.get("user_id")
    collection_id = state.get("collection_id")

    if not user_id:
        output = "No puedo acceder a metadatos sin un usuario autenticado."
        new_history = agent.create_history_entry(user_message, output)
        return {
            "data": output,
            "history": new_history,
            "previous_agent": "metadata_researcher",
            "next_agent": None,
            "rag_context": "",
            "prompt_version": prompt_spec.version,
        }

    ensure_metadata_index(agent=agent, user_id=user_id, collection_id=collection_id)
    prompt_rag = agent.retrieve(
        user_message=user_message,
        strategy=get_rag_strategy_config(),
    )
    prompt_final = agent.create_prompt(
        message=_build_prompt_input(
            user_message=user_message,
            history=history,
            rag_context=prompt_rag,
        )
    )
    output = agent.invoke(prompt_final)

    new_history = agent.create_history_entry(user_message, output)
    agent.print_agent_execution(agent="METADATA RESEARCHER", input=prompt_final, output=output)

    return {
        "data": output,
        "history": new_history,
        "previous_agent": "metadata_researcher",
        "next_agent": None,
        "rag_context": prompt_rag,
        "prompt_version": prompt_spec.version,
    }


def _build_scope_query(user_id: str, collection_id: Optional[str] = None) -> Dict:
    query: Dict = {"id_user": user_id}
    if collection_id:
        query["collection_ids"] = {"$in": [collection_id]}
    return query


def _scope_key(user_id: str, collection_id: Optional[str] = None) -> str:
    return f"{user_id}:{collection_id or '__all__'}"


def _scope_index_dir(user_id: str, collection_id: Optional[str] = None) -> Path:
    scope_dir = collection_id or "__all__"
    return METADATA_INDEXES_DIR / str(user_id) / scope_dir


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


def load_documents(user_id: str, collection_id: Optional[str] = None) -> Tuple[List[Document], str]:
    """
    Carga documentos de metadata ya filtrados por usuario y opcionalmente por colección.
    Devuelve también una firma para invalidar índice cuando cambia el corpus.
    """
    query = _build_scope_query(user_id=user_id, collection_id=collection_id)
    mongo_docs = list(ARTICLES_COLLECTION.find(query))
    mongo_docs.sort(key=lambda doc: str(doc.get("_id", "")))

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


def ensure_metadata_index(agent: RagAgent, user_id: str, collection_id: Optional[str] = None) -> None:
    scope_key = _scope_key(user_id=user_id, collection_id=collection_id)
    index_dir = _scope_index_dir(user_id=user_id, collection_id=collection_id)
    docs, signature = load_documents(user_id=user_id, collection_id=collection_id)

    if not docs:
        agent.vector_store = None
        return

    cache_entry = _METADATA_INDEX_CACHE.get(scope_key)
    if cache_entry and cache_entry.get("signature") == signature:
        agent.vector_store = cache_entry.get("store")
        return

    signature_on_disk = _load_signature(index_dir)
    if (index_dir / "index.faiss").exists() and signature_on_disk == signature:
        agent.vector_store = RagAgent.load_index(str(index_dir), agent.embedding_model)
        _METADATA_INDEX_CACHE[scope_key] = {"signature": signature, "store": agent.vector_store}
        return

    # Si cambia la firma, reconstruimos para evitar contaminación de documentos antiguos.
    agent.process_documents(docs=docs)
    agent.save_index(str(index_dir))
    _save_signature(index_dir=index_dir, signature=signature, count=len(docs))
    _METADATA_INDEX_CACHE[scope_key] = {"signature": signature, "store": agent.vector_store}
    logger.info(
        "Indice metadata reconstruido para usuario=%s collection=%s docs=%d",
        user_id,
        collection_id,
        len(docs),
    )
