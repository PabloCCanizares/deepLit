import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

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
