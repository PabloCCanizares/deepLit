"""
Controlador del asistente IA.

Responsabilidad: coordinar el servicio y formatear respuesta.
"""
from fastapi import Depends
from app.services.ai_assistant_service import AiAssistantService
from app.models.ai_assistant import ChatRequest
from app.core import StandardResponse


class AiAssistantController:
    def __init__(self, service: AiAssistantService = Depends()):
        self.service = service

    async def chat(self, payload: ChatRequest, current_user: dict) -> StandardResponse:
        user_name = (
            current_user.get("name")
            or current_user.get("email")
            or current_user.get("_id")
        )

        result = await self.service.chat(
            message=payload.message,
            user_id=current_user.get("_id"),
            user_name=user_name,
            selected_mode=payload.selected_mode
        )

        return StandardResponse(
            success=True,
            message="Respuesta generada correctamente",
            data=result
        )