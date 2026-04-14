from fastapi import APIRouter, Depends

from app.controllers import ClusteringController
from app.core.auth import get_current_user
from app.core.responses import StandardResponse, create_response_examples
from app.models import ClusteringRunRequest

router = APIRouter(
    prefix="/clustering",
    tags=["Clustering"],
)


@router.post(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Lanzar clustering de una colección a partir de evidence extraction",
    responses=create_response_examples(
        success_example={
            "message": "Clustering encolado correctamente",
            "data": {
                "run_id": "crun_20260414120000123456",
                "job_id": "cluster_evidence_20260414120000123456",
                "status": "queued",
                "collection_id": "col_demo",
                "evidence_extraction_run_id": "erun_20260414115500123456",
            },
        }
    ),
)
async def run_clustering(
    collection_id: str,
    payload: ClusteringRunRequest,
    current_user: dict = Depends(get_current_user),
    controller: ClusteringController = Depends(),
):
    return await controller.run_clustering(collection_id, payload, current_user)


@router.get(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Listar clustering runs de una colección",
)
async def list_clustering_runs(
    collection_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ClusteringController = Depends(),
):
    return await controller.list_runs(collection_id, current_user)


@router.get(
    "/runs/{run_id}/results",
    response_model=StandardResponse,
    summary="Listar resultados de un clustering run",
)
async def get_clustering_results(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ClusteringController = Depends(),
):
    return await controller.get_results(run_id, current_user)


@router.delete(
    "/runs/{run_id}",
    response_model=StandardResponse,
    summary="Eliminar un clustering run",
)
async def delete_clustering_run(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ClusteringController = Depends(),
):
    return await controller.delete_run(run_id, current_user)
