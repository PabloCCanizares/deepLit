"""
Servicio del asistente IA.

Responsabilidad: ejecutar el agente y devolver la respuesta.
"""
import asyncio
from typing import Dict, Optional
from app.ai_assistant.agents_graph.workflow import app

DEFAULT_TIMEOUT_SECONDS = 45
MODE_TIMEOUT_SECONDS = {
    "chatbot": 30,
    "metadata_researcher": 35,
    "deep_researcher": 55,
    "web_searcher": 35,
    "collection_synthesizer": 55,
    "nexus": 55,
}


class AiAssistantService:
    async def chat(
        self,
        message: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        selected_mode: Optional[str] = None,
        collection_id: Optional[str] = None,
        runtime_mode: Optional[str] = None,
        web_provider: Optional[str] = None,
    ) -> Dict:
        """
        Ejecuta el agente y devuelve la respuesta.
        """
        state = {
            "user_message": message,
            "user": user_name,
            "user_id": user_id,
            "selected_mode": selected_mode,
            "collection_id": collection_id,
            "runtime_mode": runtime_mode,
            "web_provider": web_provider,
        }

        if user_id:
            thread_id = f"{user_id}:{collection_id or '__all__'}"
        else:
            thread_id = user_name
        config = {"configurable": {"thread_id": str(thread_id)}}

        timeout_seconds = MODE_TIMEOUT_SECONDS.get(selected_mode or "", DEFAULT_TIMEOUT_SECONDS)

        try:
            result = await asyncio.wait_for(
                app.ainvoke(state, config=config),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            timeout_msg = (
                "La respuesta esta tardando demasiado. "
                "He cancelado la ejecucion para evitar bloqueo; prueba con una pregunta mas concreta."
            )
            return {
                "reply": timeout_msg,
                "agent": selected_mode or "assistant",
                "prompt_version": None,
                "web_search_meta": None,
                "context_source": None,
                "timed_out": True,
            }

        return {
            "reply": result["data"],
            "agent": result["previous_agent"],
            "prompt_version": result.get("prompt_version"),
            "web_search_meta": result.get("web_search_meta"),
            "context_source": result.get("context_source"),
            "timed_out": False,
        }
