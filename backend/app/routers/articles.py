"""
Rutas de Artículos.

Endpoints para gestionar artículos.
"""
import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, StreamingResponse
from app.controllers import ArticlesController
from app.models import QueryBody, Pagination, ArticleUpdate
from app.core import StandardResponse, create_response_examples, get_current_user
from app.services.sse_manager import sse_manager

router = APIRouter(prefix="/articles", tags=["Articles"])

# ============================================
# RUTAS PROTEGIDAS (requieren autenticación)
# ============================================


# ─── Cola de procesamiento ───────────────────────────────────

@router.get(
    "/cola",
    response_model=StandardResponse,
    summary="Obtener cola de procesamiento",
)
async def get_queue(
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Obtener artículos en cola de procesamiento (status processing/error).
    """
    return await controller.get_queue(current_user)


# ─── SSE — Eventos en tiempo real ────────────────────────────

@router.get(
    "/events",
    summary="Stream de eventos SSE",
)
async def sse_events(
    token: str = None,
):
    """
    Endpoint SSE para recibir actualizaciones en tiempo real.
    Acepta token via query param porque EventSource no soporta headers.
    """
    from app.core.auth import decode_token
    from app.repositories.user_repository import UserRepository

    if not token:
        from app.core import AuthenticationError
        raise AuthenticationError("No se proporcionó token de autenticación")

    email = decode_token(token)
    if not email:
        from app.core import AuthenticationError
        raise AuthenticationError("Token inválido o expirado")

    user_repo = UserRepository()
    user = await user_repo.find_by_email(email)
    if not user:
        from app.core import AuthenticationError
        raise AuthenticationError("Usuario no encontrado")

    user_id = user["_id"]

    async def event_generator():
        queue = sse_manager.subscribe(user_id)
        try:
            while True:
                try:
                    # Esperar evento con timeout (keepalive cada 30s)
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    event_name = event["event"]
                    event_data = json.dumps(event["data"], default=str)
                    yield f"event: {event_name}\ndata: {event_data}\n\n"
                except asyncio.TimeoutError:
                    # Enviar ping keepalive para mantener conexión
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.unsubscribe(user_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx compatibility
        }
    )



# ─── Búsqueda de artículos ───────────────────────────────────

@router.post(
    "/search",  # POST /articles/search
    response_model=StandardResponse,
    summary="Buscar artículos del usuario",
    responses=create_response_examples(
        success_example={
            "message": "Artículos recuperados exitosamente",
            "data": [
                {
                    "_id": "article_123",
                    "title": "Título del artículo",
                    "abstract": "Resumen",
                    "year": "2024"
                }
            ]
        },
        error_example={
            "message": "Error al obtener artículos",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_user_articles(
    query: QueryBody,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Obtener lista de artículos del usuario autenticado.
    Excluye artículos en estado 'processing' o 'error'.
    """
    return await controller.get_user_articles(query, current_user)


@router.get(
    "/{article_id}/pdf",
    summary="Obtener PDF asociado a un artículo",
)
async def get_article_pdf(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Devuelve el PDF asociado al artículo para visualización o descarga.
    """
    pdf_path, filename = await controller.get_pdf_file(article_id, current_user)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.get(
    "/{article_id}",
    response_model=StandardResponse,
    summary="Obtener artículo por ID",
    responses=create_response_examples(
        success_example={
            "message": "Artículo recuperado correctamente",
            "data": {
                "_id": "article_123",
                "title": "Título del artículo",
                "abstract": "Resumen del artículo",
                "year": "2024",
                "authors": "Autor 1, Autor 2"
            }
        },
        error_example={
            "message": "Artículo no encontrado",
            "error": "El artículo solicitado no existe",
            "error_code": "NOT_FOUND"
        }
    )
)
async def get_article_by_id(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Obtener un artículo específico por su ID.
    Solo puede acceder el usuario propietario del artículo.
    """
    return await controller.get_by_id(article_id, current_user)


@router.get(
    "/{article_id}/status",
    response_model=StandardResponse,
    summary="Obtener status de un artículo",
)
async def get_article_status(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Consultar el status de procesamiento de un artículo.
    """
    return await controller.get_article_status(article_id, current_user)


@router.put(
    "/{article_id}",
    response_model=StandardResponse,
    summary="Actualizar artículo",
    responses=create_response_examples(
        success_example={
            "message": "Artículo actualizado correctamente",
            "data": {
                "_id": "article_123",
                "title": "Título actualizado",
                "abstract": "Resumen actualizado"
            }
        },
        error_example={
            "message": "No tienes permiso para modificar este artículo",
            "error": "FORBIDDEN",
            "error_code": "PERMISSION_DENIED"
        }
    )
)
async def update_article(
    article_id: str,
    update_data: ArticleUpdate,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Actualizar un artículo específico.
    Solo puede actualizar el usuario propietario del artículo.
    """
    return await controller.update(article_id, update_data, current_user)


@router.delete(
    "/{article_id}",
    response_model=StandardResponse,
    summary="Eliminar artículo",
    responses=create_response_examples(
        success_example={
            "message": "Artículo eliminado correctamente",
            "data": {"deleted": True}
        },
        error_example={
            "message": "No tienes permiso para eliminar este artículo",
            "error": "FORBIDDEN",
            "error_code": "PERMISSION_DENIED"
        }
    )
)
async def delete_article(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ArticlesController = Depends()
):
    """
    Eliminar un artículo específico.
    Solo puede eliminar el usuario propietario del artículo.
    """
    return await controller.delete(article_id, current_user)

