import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

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

# Servicio del grafo de artículos. Si Neo4j no está configurado se queda
# en modo no-op y `build_user_graph_text` devolverá cadena vacía.
_article_graph_service = ArticleGraphService()


async def _build_graph_block(user_id):
    """Devuelve el bloque de texto con el grafo del usuario (best-effort)."""
    if not user_id:
        return ""
    try:
        text = await asyncio.to_thread(
            _article_graph_service.build_user_graph_text, user_id
        )
    except Exception as exc:
        logger.warning("No se pudo recuperar grafo para deep_researcher: %s", exc)
        return ""
    if not text:
        return ""
    return (
        "\n--- GRAFO DE CONOCIMIENTO (Neo4j) ---\n"
        f"{text}\n"
        "--- FIN DEL GRAFO ---\n"
    )


async def deep_research(state):
    prompt_spec = get_prompt_spec("deep_researcher")
    config = get_deep_researcher_config()
    agent = RagEngine(**config, system_prompt=DEEP_RESEARCHER_PROMPT)

    user_message = state["user_message"]
    history = state.get("history", [])
    user_id = state.get("user_id")
    collection_id = state.get("collection_id")
    input_processed = f"{user_message} El historial es: {history}"

    await load_faiss_indexes(agent=agent, user_id=user_id, collection_id=collection_id)
    rag = agent.retrieve(
        user_message=user_message,
        strategy=get_rag_strategy_config(),
    )

    graph_block = await _build_graph_block(user_id)

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

    prompt_final = agent.create_prompt(message=input_processed + rag + graph_block)
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
