from fastapi import APIRouter, Depends

from app.controllers import ScreeningController
from app.core.auth import get_current_user
from app.core.responses import StandardResponse, create_response_examples
from app.models import ScreeningDecisionUpdateRequest, ScreeningRunRequest

router = APIRouter(
    prefix="/screening",
    tags=["Screening"],
)


@router.post(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Lanzar screening de una colección",
    responses=create_response_examples(
        success_example={
            "message": "Screening encolado correctamente",
            "data": {
                "job_id": "screen_collection_20260412123000123456",
                "status": "queued",
                "collection_id": "col_demo",
                "research_question": "Quiero artículos sobre predicción estacional de sequía.",
            },
        }
    ),
)
async def run_collection_screening(
    collection_id: str,
    payload: ScreeningRunRequest,
    current_user: dict = Depends(get_current_user),
    controller: ScreeningController = Depends(),
):
    return await controller.run_screening(collection_id, payload, current_user)


@router.get(
    "/collections/{collection_id}/runs",
    response_model=StandardResponse,
    summary="Listar screening runs de una colección",
)
async def list_collection_screening_runs(
    collection_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ScreeningController = Depends(),
):
    return await controller.list_runs(collection_id, current_user)


@router.get(
    "/runs/{run_id}/results",
    response_model=StandardResponse,
    summary="Listar resultados de un screening run",
)
async def get_screening_run_results(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ScreeningController = Depends(),
):
    return await controller.get_results(
        run_id=run_id,
        current_user=current_user,
    )


@router.patch(
    "/runs/{run_id}/results/{article_id}",
    response_model=StandardResponse,
    summary="Actualizar manualmente un resultado de screening",
)
async def update_screening_run_result(
    run_id: str,
    article_id: str,
    payload: ScreeningDecisionUpdateRequest,
    current_user: dict = Depends(get_current_user),
    controller: ScreeningController = Depends(),
):
    return await controller.update_result(
        run_id=run_id,
        article_id=article_id,
        payload=payload,
        current_user=current_user,
    )


@router.delete(
    "/runs/{run_id}",
    response_model=StandardResponse,
    summary="Eliminar un screening run",
)
async def delete_screening_run(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    controller: ScreeningController = Depends(),
):
    return await controller.delete_run(
        run_id=run_id,
        current_user=current_user,
    )
