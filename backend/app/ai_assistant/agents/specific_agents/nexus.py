"""
Nexus: sintetiza conocimiento multi-documento del usuario.
"""
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

import logging

from ..base_agents.rag_agent import RagAgent
from ..config import get_deep_researcher_config, get_rag_strategy_config
from ..prompts import NEXUS_PROMPT, get_prompt_spec
from .deep_researcher import load_faiss_indexes

logger = logging.getLogger(__name__)
LLM_TIMEOUT_SECONDS = 45


def nexus_node(state):
    prompt_spec = get_prompt_spec("nexus")
    config = get_deep_researcher_config()
    agent = RagAgent(**config, system_prompt=NEXUS_PROMPT)

    user_message = state["user_message"]
    history = state.get("history", [])
    user_id = state.get("user_id")
    collection_id = state.get("collection_id")
    input_processed = f"{user_message}\nHistorial relevante: {history}"

    load_faiss_indexes(agent=agent, user_id=user_id, collection_id=collection_id)
    strategy = get_rag_strategy_config()
    strategy["k"] = max(10, int(strategy.get("k", 8)))
    strategy["max_context_chars"] = max(16000, int(strategy.get("max_context_chars", 12000)))
    rag = agent.retrieve(user_message=user_message, strategy=strategy)

    if "NO HAY CONTEXTO DISPONIBLE" in rag or "NO SE ENCONTR" in rag:
        output = "No hay contexto documental suficiente para generar una sintesis Nexus."
        new_history = agent.create_history_entry(user_message, output)
        return {
            "data": output,
            "history": new_history,
            "previous_agent": "nexus",
            "next_agent": None,
            "rag_context": rag,
            "prompt_version": prompt_spec.version,
        }

    prompt_final = agent.create_prompt(message=input_processed + "\n\n" + rag)
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(agent.invoke, prompt_final)
            output = future.result(timeout=LLM_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        logger.warning("Timeout en nexus para user_id=%s", user_id)
        output = "La sintesis Nexus excedio el tiempo de espera. Intenta reducir el alcance de la consulta."
    new_history = agent.create_history_entry(user_message, output)

    agent.print_agent_execution(agent="NEXUS", input=prompt_final, output=output)

    return {
        "data": output,
        "history": new_history,
        "previous_agent": "nexus",
        "next_agent": None,
        "rag_context": rag,
        "prompt_version": prompt_spec.version,
    }
