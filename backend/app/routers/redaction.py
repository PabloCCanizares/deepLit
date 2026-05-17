from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.controllers import RedactionController
from app.core.auth import get_current_user
from app.core.responses import StandardResponse
from app.models import RedactionRunRequest

router = APIRouter(
    prefix="/redaction",
    tags=["Redaction"],
)


@router.post(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Lanzar una redaccion asistida para una coleccion",
)
async def run_redaction(
    collection_id: str,
    payload: RedactionRunRequest,
    current_user: dict = Depends(get_current_user),
    controller: RedactionController = Depends(),
):
    return await controller.run_redaction(collection_id, payload, current_user)


@router.get(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Listar redacciones de una coleccion",
)
async def list_redaction_runs(
    collection_id: str,
    parent_run_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    controller: RedactionController = Depends(),
):
    return await controller.list_runs(collection_id, current_user, parent_run_id)


@router.get(
    "/runs/{run_id}",
    response_model=StandardResponse,
    summary="Obtener una redaccion concreta",
)
async def get_redaction_run(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: RedactionController = Depends(),
):
    return await controller.get_run(run_id, current_user)


@router.delete(
    "/runs/{run_id}",
    response_model=StandardResponse,
    summary="Eliminar una redaccion",
)
async def delete_redaction_run(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: RedactionController = Depends(),
):
    return await controller.delete_run(run_id, current_user)
