import logging

from langchain_core.messages import AIMessage, HumanMessage

from app.services.web_search_service import WebSearchService

from ..agents.base_agents.base_agent import BaseAgent
from ..config import get_web_searcher_config
from ..prompts import WEB_SEARCHER_PROMPT, get_prompt_spec

logger = logging.getLogger(__name__)


def _history_to_text(history) -> str:
    lines = []
    for item in history or []:
        content = getattr(item, "content", item)
        if isinstance(content, list):
            text = " ".join(
                str(part.get("text") or part.get("content") or "") if isinstance(part, dict) else str(part)
                for part in content
            ).strip()
        else:
            text = str(content or "").strip()
        if text:
            lines.append(text)
    return "\n".join(lines[-6:]) or "Sin historial relevante."


def _build_query_prompt(user_message: str, history_text: str, collection_context: str) -> str:
    return (
        f"Consulta del usuario:\n{user_message}\n\n"
        f"Historial reciente:\n{history_text}\n\n"
        f"Articulos disponibles en la coleccion:\n{collection_context}\n\n"
        "Devuelve solo una unica consulta de busqueda web, en una sola linea.\n"
        "Si el usuario dice 'este autor' o 'este articulo', resuelvelo usando el historial o la coleccion.\n"
        "Si no puedes resolver la referencia con seguridad, no inventes nombres: conserva la idea general.\n"
        "No expliques nada. Devuelve solo la consulta."
    )


def _normalize_query(raw_query: str, fallback: str) -> str:
    text = str(raw_query or "").strip().splitlines()[0].strip()
    return text or fallback


def web_search(state):
    prompt_spec = get_prompt_spec("web_searcher")
    query = state["user_message"]
    runtime_mode = state.get("runtime_mode")
    provider = state.get("web_provider")
    history = state.get("history", [])
    user_id = state.get("user_id")
    collection_id = state.get("collection_id")

    try:
        service = WebSearchService()
        planner = BaseAgent(system_prompt=WEB_SEARCHER_PROMPT, **get_web_searcher_config())
        history_text = _history_to_text(history)
        collection_context = service.get_collection_context(user_id, collection_id)
        planner_prompt = planner.create_prompt(
            message=_build_query_prompt(query, history_text, collection_context)
        )
        effective_query = _normalize_query(planner.invoke(planner_prompt), query)

        result = service.search(
            query=effective_query,
            provider=provider,
            runtime_mode=runtime_mode,
        )
        output = service.build_cited_response(
            user_query=query,
            effective_query=effective_query,
            results=result["results"],
            provider=result["provider"],
            from_cache=result["from_cache"],
        )
        new_history = [HumanMessage(content=query), AIMessage(content=output)]
        web_meta = {
            "provider": result["provider"],
            "mode": result["mode"],
            "from_cache": result["from_cache"],
            "sources": len(result["results"]),
            "effective_query": effective_query,
        }
    except Exception as exc:
        logger.warning("Error en web_searcher: %s", exc)
        output = (
            "No pude completar la busqueda web en este momento. "
            "Intenta de nuevo en unos segundos o reformula con mas contexto."
        )
        new_history = [HumanMessage(content=query), AIMessage(content=output)]
        web_meta = {
            "provider": provider or "duckduckgo",
            "mode": runtime_mode or "online",
            "from_cache": False,
            "sources": 0,
            "error": "web_search_failed",
        }

    return {
        "data": output,
        "history": new_history,
        "previous_agent": "web_searcher",
        "next_agent": None,
        "prompt_version": prompt_spec.version,
        "web_search_meta": web_meta,
        "context_source": "collection+web" if collection_id else "web",
    }
