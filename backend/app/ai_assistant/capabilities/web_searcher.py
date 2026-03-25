import logging

from app.services.web_search_service import WebSearchService

from ..agents.prompts import get_prompt_spec

logger = logging.getLogger(__name__)


def web_search(state):
    prompt_spec = get_prompt_spec("web_searcher")
    query = state["user_message"]
    runtime_mode = state.get("runtime_mode")
    provider = state.get("web_provider")

    try:
        service = WebSearchService()
        result = service.search(
            query=query,
            provider=provider,
            runtime_mode=runtime_mode,
        )
        output = service.build_cited_response(
            query=query,
            results=result["results"],
            provider=result["provider"],
            from_cache=result["from_cache"],
        )
        web_meta = {
            "provider": result["provider"],
            "mode": result["mode"],
            "from_cache": result["from_cache"],
            "sources": len(result["results"]),
        }
    except Exception as exc:
        logger.warning("Error en web_searcher: %s", exc)
        output = (
            "No pude completar la busqueda web en este momento. "
            "Intenta de nuevo en unos segundos o cambia el proveedor."
        )
        web_meta = {
            "provider": provider or "duckduckgo",
            "mode": runtime_mode or "online",
            "from_cache": False,
            "sources": 0,
            "error": "web_search_failed",
        }

    return {
        "data": output,
        "previous_agent": "web_searcher",
        "next_agent": None,
        "prompt_version": prompt_spec.version,
        "web_search_meta": web_meta,
    }
