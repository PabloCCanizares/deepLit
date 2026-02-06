"""
Router para configuración runtime.

Permite al frontend actualizar la configuración en tiempo de ejecución.
"""
from fastapi import APIRouter
from app.services.runtime_config_service import RuntimeConfigService
from app.core import StandardResponse
from pydantic import BaseModel

router = APIRouter(prefix="/runtime-config", tags=["Runtime Config"])


class RuntimeConfigUpdate(BaseModel):
    offline: bool


@router.get(
    "",
    response_model=StandardResponse,
    summary="Obtener configuración runtime"
)
async def get_runtime_config():
    """
    Obtiene la configuración runtime actual.
    """
    config = RuntimeConfigService.get_all_config()
    return StandardResponse(
        success=True,
        message="Configuración obtenida",
        data=config
    )


@router.put(
    "",
    response_model=StandardResponse,
    summary="Actualizar configuración runtime"
)
async def update_runtime_config(config_update: RuntimeConfigUpdate):
    """
    Actualiza la configuración runtime (offline mode).
    """
    updated_config = RuntimeConfigService.set_offline_mode(config_update.offline)
    mode = "OFFLINE (Ollama local)" if config_update.offline else "ONLINE (Google Gemini)"
    return StandardResponse(
        success=True,
        message=f"Configuración actualizada. Modo: {mode}",
        data=updated_config
    )
