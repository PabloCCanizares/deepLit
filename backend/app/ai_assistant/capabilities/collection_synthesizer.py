"""
Collection Synthesizer: sintetiza una coleccion concreta del usuario.

Reutiliza la base de RAG ya existente:
- primero intenta trabajar con texto completo indexado (FAISS por PDF)
- si no hay suficiente contexto, hace fallback a metadatos/abstracts
"""
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import logging
from typing import Optional, Tuple

from ..agents.base_agents.rag_agent import RagAgent
from ..agents.config import get_deep_researcher_config, get_rag_strategy_config
from ..agents.prompts import COLLECTION_SYNTHESIZER_PROMPT, get_prompt_spec
from ..retrieval.faiss_loader import load_faiss_indexes
from ..retrieval.metadata_index import ensure_metadata_index

logger = logging.getLogger(__name__)

FULL_TEXT_CONTEXT = "full_text"
METADATA_CONTEXT = "metadata"
LLM_TIMEOUT_SECONDS = 45
NO_CONTEXT_MARKERS = (
    "NO HAY CONTEXTO DISPONIBLE",
    "NO SE ENCONTR",
)


def rag_has_context(rag_context: Optional[str]) -> bool:
    if not rag_context:
        return False
    return all(marker not in rag_context for marker in NO_CONTEXT_MARKERS)


def _get_collection_strategy() -> dict:
    strategy = get_rag_strategy_config()
    strategy["k"] = max(10, int(strategy.get("k", 8)))
    strategy["max_context_chars"] = max(16000, int(strategy.get("max_context_chars", 12000)))
    strategy["group_by_article"] = True
    strategy["max_chunks_per_article"] = 2
    return strategy


async def _retrieve_collection_context(
    agent: RagAgent,
    user_message: str,
    user_id: str,
    collection_id: str,
) -> Tuple[str, Optional[str]]:
    strategy = _get_collection_strategy()

    await load_faiss_indexes(agent=agent, user_id=user_id, collection_id=collection_id)
    rag_context = agent.retrieve(user_message=user_message, strategy=strategy)
    if rag_has_context(rag_context):
        return rag_context, FULL_TEXT_CONTEXT

    await ensure_metadata_index(agent=agent, user_id=user_id, collection_id=collection_id)
    rag_context = agent.retrieve(user_message=user_message, strategy=strategy)
    if rag_has_context(rag_context):
        return rag_context, METADATA_CONTEXT

    return rag_context, None


def _build_prompt_input(
    user_message: str,
    history,
    collection_id: str,
    context_source: str,
) -> str:
    source_label = (
        "texto completo indexado"
        if context_source == FULL_TEXT_CONTEXT
        else "metadatos, abstracts y notas del usuario"
    )
    return (
        f"Coleccion activa: {collection_id}\n"
        f"Solicitud del usuario: {user_message}\n"
        f"Historial relevante: {history}\n"
        f"Fuente principal disponible: {source_label}\n\n"
    )


async def collection_synthesize(state):
    user_message = state["user_message"]
    history = state.get("history", [])
    user_id = state.get("user_id")
    collection_id = state.get("collection_id")

    prompt_spec = get_prompt_spec("collection_synthesizer")

    if not user_id:
        output = "No puedo sintetizar una coleccion sin un usuario autenticado."
        return {
            "data": output,
            "history": [],
            "previous_agent": "collection_synthesizer",
            "next_agent": None,
            "rag_context": "",
            "prompt_version": prompt_spec.version,
            "context_source": None,
        }

    if not collection_id:
        output = (
            "Para usar la sintesis de coleccion, primero selecciona una coleccion activa "
            "en la barra superior."
        )
        return {
            "data": output,
            "history": [],
            "previous_agent": "collection_synthesizer",
            "next_agent": None,
            "rag_context": "",
            "prompt_version": prompt_spec.version,
            "context_source": None,
        }

    config = get_deep_researcher_config()
    agent = RagAgent(**config, system_prompt=COLLECTION_SYNTHESIZER_PROMPT)

    rag_context, context_source = await _retrieve_collection_context(
        agent=agent,
        user_message=user_message,
        user_id=user_id,
        collection_id=collection_id,
    )

    if not context_source:
        output = (
            "No encuentro suficiente contenido en la coleccion seleccionada para hacer una "
            "sintesis fiable. Necesito articulos con PDF procesado o al menos metadatos utiles."
        )
        new_history = agent.create_history_entry(user_message, output)
        return {
            "data": output,
            "history": new_history,
            "previous_agent": "collection_synthesizer",
            "next_agent": None,
            "rag_context": rag_context,
            "prompt_version": prompt_spec.version,
            "context_source": None,
        }

    prompt_final = agent.create_prompt(
        message=_build_prompt_input(
            user_message=user_message,
            history=history,
            collection_id=collection_id,
            context_source=context_source,
        ) + rag_context
    )

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(agent.invoke, prompt_final)
            output = future.result(timeout=LLM_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        logger.warning("Timeout en collection_synthesizer para user_id=%s", user_id)
        output = "La sintesis de la coleccion tarda demasiado. Intenta acotar mas la consulta."

    if context_source == METADATA_CONTEXT:
        output = (
            "Nota: esta sintesis se ha generado con metadatos y resumenes disponibles, "
            "porque no encontre suficiente texto completo indexado en la coleccion.\n\n"
            f"{output}"
        )

    new_history = agent.create_history_entry(user_message, output)
    agent.print_agent_execution(agent="COLLECTION SYNTHESIZER", input=prompt_final, output=output)

    return {
        "data": output,
        "history": new_history,
        "previous_agent": "collection_synthesizer",
        "next_agent": None,
        "rag_context": rag_context,
        "prompt_version": prompt_spec.version,
        "context_source": context_source,
    }
