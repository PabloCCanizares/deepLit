"""
Servicio del asistente IA.

Responsabilidad: ejecutar el agente y devolver la respuesta.
"""
from typing import Dict, Optional
from app.ai_assistant.agents_graph.workflow import app


class AiAssistantService:
    async def chat(
        self,
        message: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        selected_mode: Optional[str] = None
    ) -> Dict:
        """
        Ejecuta el agente y devuelve la respuesta.
        """
        state = {
            "user_message": message,
            "user": user_name,
            "user_id": user_id,
            "selected_mode": selected_mode
        }

        thread_id = user_id or user_name
        config = {"configurable": {"thread_id": str(thread_id)}}

        result = await app.ainvoke(state, config=config)

        return {
            "reply": result["data"],
            "agent": result["previous_agent"]
        }