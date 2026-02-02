from pydantic import BaseModel, Field
from typing import Optional


class ChatRequest(BaseModel):
    """
    Request para el chat del asistente.
    """
    message: str = Field(..., min_length=1, description="Mensaje del usuario")
    selected_mode: Optional[str] = Field(
        None,
        description="Modo/herramienta seleccionada (opcional)"
    )