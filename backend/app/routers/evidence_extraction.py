from fastapi import APIRouter, Depends

from app.controllers import EvidenceExtractionController
from app.core.auth import get_current_user
from app.core.responses import StandardResponse, create_response_examples
from app.models import EvidenceExtractionRunRequest

router = APIRouter(
    prefix="/evidence-extraction",
    tags=["Evidence Extraction"],
)


@router.post(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Lanzar evidence extraction de una colección",
    responses=create_response_examples(
        success_example={
            "message": "Extraccion de evidencia encolada correctamente",
            "data": {
                "run_id": "erun_20260413130000123456",
                "job_id": "extract_evidence_20260413130000123456",
                "status": "queued",
                "collection_id": "col_demo",
                "selection_mode": "all",
            },
        }
    ),
)
async def run_evidence_extraction(
    collection_id: str,
    payload: EvidenceExtractionRunRequest,
    current_user: dict = Depends(get_current_user),
    controller: EvidenceExtractionController = Depends(),
):
    return await controller.run_extraction(collection_id, payload, current_user)


@router.get(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Listar evidence extraction runs de una colección",
)
async def list_evidence_extraction_runs(
    collection_id: str,
    current_user: dict = Depends(get_current_user),
    controller: EvidenceExtractionController = Depends(),
):
    return await controller.list_runs(collection_id, current_user)


@router.get(
    "/runs/{run_id}/results",
    response_model=StandardResponse,
    summary="Listar resultados de un evidence extraction run",
)
async def get_evidence_extraction_results(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: EvidenceExtractionController = Depends(),
):
    return await controller.get_results(run_id, current_user)


@router.delete(
    "/runs/{run_id}",
    response_model=StandardResponse,
    summary="Eliminar un evidence extraction run",
)
async def delete_evidence_extraction_run(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: EvidenceExtractionController = Depends(),
):
    return await controller.delete_run(run_id, current_user)
