from ..agents.base_agents.rag_agent import RagAgent
from ..agents.config import (
    get_metadata_config,
    get_rag_strategy_config,
)
from ..agents.prompts import METADATA_RESEARCHER
from ..agents.prompts import get_prompt_spec
from ..retrieval.metadata_index import ensure_metadata_index


def _build_prompt_input(user_message: str, history, rag_context: str) -> str:
    return (
        f"Pregunta del usuario: {user_message}\n"
        f"Historial relevante: {history}\n\n"
        f"{rag_context}"
    )


async def metadata_research(state):
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

    await ensure_metadata_index(agent=agent, user_id=user_id, collection_id=collection_id)
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
