import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import List

from app.services.article_graph_service import ArticleGraphService

from ..agents.base_agents.rag_engine import RagEngine
from ..config import (
    get_deep_researcher_config,
    get_rag_strategy_config,
)
from ..prompts import DEEP_RESEARCHER_PROMPT
from ..prompts import get_prompt_spec
from ..retrieval.faiss_loader import load_faiss_indexes

logger = logging.getLogger(__name__)
LLM_TIMEOUT_SECONDS = 45

# Servicio del grafo. Si Neo4j no está configurado opera en modo no-op.
_article_graph_service = ArticleGraphService()


async def _run_hybrid_graph(user_id: str, seed_article_ids: List[str]) -> dict:
    """Calcula relaciones del grafo para los artículos del RAG (best-effort)."""
    empty = {"formatted_context": "", "similarity_pairs": []}
    if not user_id or not seed_article_ids:
        return empty
    try:
        return await asyncio.to_thread(
            _article_graph_service.get_hybrid_graph_context,
            user_id,
            seed_article_ids,
        )
    except Exception as exc:
        logger.warning("get_hybrid_graph_context falló para user_id=%s: %s", user_id, exc)
        return empty


async def deep_research(state):
    prompt_spec = get_prompt_spec("deep_researcher")
    config = get_deep_researcher_config()
    agent = RagEngine(**config, system_prompt=DEEP_RESEARCHER_PROMPT)

    user_message = state["user_message"]
    history = state.get("history", [])
    user_id = state.get("user_id")
    collection_id = state.get("collection_id")
    input_processed = f"{user_message} El historial es: {history}"

    # 1. Cargar índices FAISS y recuperar docs estándar
    await load_faiss_indexes(agent=agent, user_id=user_id, collection_id=collection_id)
    docs = agent.search_docs(user_message=user_message, strategy=get_rag_strategy_config())
    rag = agent.format_docs_as_context(docs, strategy=get_rag_strategy_config())

    if "NO HAY CONTEXTO DISPONIBLE" in rag or "NO SE ENCONTR" in rag:
        output = "No hay contexto suficiente para responder con profundidad. Sube o indexa articulos primero."
        new_history = agent.create_history_entry(user_message, output)
        return {
            "data": output,
            "history": new_history,
            "previous_agent": "deep_researcher",
            "next_agent": None,
            "rag_context": rag,
            "graph_rag_context": "",
            "prompt_version": prompt_spec.version,
        }

    # 2. Extraer article_ids de los docs FAISS (semillas para el grafo)
    seed_ids: List[str] = list(
        dict.fromkeys(
            str(doc.metadata.get("article_id"))
            for doc in docs
            if doc.metadata.get("article_id")
        )
    )

    # 3. El grafo calcula relaciones ENTRE los artículos que encontró el RAG
    graph_result = await _run_hybrid_graph(user_id, seed_ids)
    graph_context: str = graph_result.get("formatted_context", "")

    # 4. Prompt: contexto del grafo primero (relaciones), luego el RAG (contenido)
    prompt_final = agent.create_prompt(
        message=input_processed
        + (graph_context + "\n" if graph_context else "")
        + rag
    )

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
        "graph_rag_context": graph_context,
        "prompt_version": prompt_spec.version,
    }
