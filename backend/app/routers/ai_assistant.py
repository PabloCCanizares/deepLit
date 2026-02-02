"""
Rutas del asistente IA.
"""
from fastapi import APIRouter, Depends
from app.controllers.ai_assistant_controller import AiAssistantController
from app.models.ai_assistant import ChatRequest
from app.core import StandardResponse, create_response_examples, get_current_user


router = APIRouter(prefix="/ai-assistant", tags=["AI Assistant"])


@router.post(
	"/chat",
	response_model=StandardResponse,
	summary="Enviar mensaje al asistente IA",
	responses=create_response_examples(
		success_example={
			"message": "Respuesta generada correctamente",
			"data": {
				"reply": "Hola, ¿en qué puedo ayudarte?",
				"agent": "chatbot"
			}
		},
		error_example={
			"message": "Error al procesar la solicitud",
			"error": "Token inválido o expirado",
			"error_code": "AUTHENTICATION_ERROR"
		}
	)
)
async def chat(
	payload: ChatRequest,
	current_user: dict = Depends(get_current_user),
	controller: AiAssistantController = Depends()
):
	"""
	Enviar un mensaje al asistente IA y obtener la respuesta.
	"""
	return await controller.chat(payload, current_user)
