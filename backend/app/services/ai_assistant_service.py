"""
Servicio del asistente IA.

Responsabilidad: ejecutar el agente y devolver la respuesta.
"""
import asyncio
from typing import Dict, Optional
from app.ai_assistant.graph.workflow import app


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
            "selected_mode": selected_mode
        }

        thread_id = user_id or user_name
        config = {"configurable": {"thread_id": str(thread_id)}}

        # Usar invoke síncrono en un thread separado porque
        # langgraph-checkpoint-mongodb 0.1.4 no soporta operaciones asíncronas
        result = await asyncio.to_thread(app.invoke, state, config=config)

        return {
            "reply": result["data"],
            "agent": result["previous_agent"]
        }