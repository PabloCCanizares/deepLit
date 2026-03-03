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
    collection_id: Optional[str] = Field(
        None,
        description="ID de coleccion para acotar el contexto del asistente (opcional)",
    )
    runtime_mode: Optional[str] = Field(
        None,
        description="Modo runtime del asistente: online u offline (opcional)",
    )
    web_provider: Optional[str] = Field(
        None,
        description="Proveedor de busqueda web (opcional): duckduckgo o hackernews",
    )
