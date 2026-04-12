from fastapi import APIRouter, Depends

from app.controllers import CollectionResearcherController
from app.core.auth import get_current_user
from app.core.responses import StandardResponse
from app.models import CollectionSynthesisPaperRequest, CollectionSynthesisRunRequest

router = APIRouter(
    prefix="/collection-researcher",
    tags=["Collection Researcher"],
)


@router.post(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Generar una sintesis de coleccion",
)
async def run_collection_synthesis(
    collection_id: str,
    payload: CollectionSynthesisRunRequest,
    current_user: dict = Depends(get_current_user),
    controller: CollectionResearcherController = Depends(),
):
    return await controller.run_synthesis(collection_id, payload, current_user)


@router.get(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Listar sintesis de una coleccion",
)
async def list_collection_syntheses(
    collection_id: str,
    current_user: dict = Depends(get_current_user),
    controller: CollectionResearcherController = Depends(),
):
    return await controller.list_runs(collection_id, current_user)


@router.patch(
    "/runs/{run_id}/paper",
    response_model=StandardResponse,
    summary="Guardar la version paper de una sintesis",
)
async def save_collection_synthesis_paper(
    run_id: str,
    payload: CollectionSynthesisPaperRequest,
    current_user: dict = Depends(get_current_user),
    controller: CollectionResearcherController = Depends(),
):
    return await controller.save_paper(run_id, payload, current_user)


@router.delete(
    "/runs/{run_id}",
    response_model=StandardResponse,
    summary="Eliminar una sintesis de coleccion",
)
async def delete_collection_synthesis(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: CollectionResearcherController = Depends(),
):
    return await controller.delete_run(run_id, current_user)
