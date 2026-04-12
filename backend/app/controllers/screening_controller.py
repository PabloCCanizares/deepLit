from fastapi import Depends

from app.core import NotFoundError, StandardResponse
from app.models import ScreeningRunData, ScreeningRunRequest
from app.services.collection_service import CollectionService
from app.services.job_service import JobService
from app.services.screening_decision_service import ScreeningDecisionService
from app.services.screening_run_service import ScreeningRunService


class ScreeningController:
    def __init__(
        self,
        collection_service: CollectionService = Depends(),
        job_service: JobService = Depends(),
        screening_decision_service: ScreeningDecisionService = Depends(),
        screening_run_service: ScreeningRunService = Depends(),
    ):
        self.collection_service = collection_service
        self.job_service = job_service
        self.screening_decision_service = screening_decision_service
        self.screening_run_service = screening_run_service

    async def run_screening(
        self,
        collection_id: str,
        payload: ScreeningRunRequest,
        current_user: dict,
    ) -> StandardResponse:
        exists = await self.collection_service.collection_exists(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        if not exists:
            raise NotFoundError("Colección no encontrada")

        run = await self.screening_run_service.create_run(
            user_id=current_user["_id"],
            run_data=ScreeningRunData(
                collection_id=collection_id,
                research_question=payload.research_question,
                inclusion_criteria=payload.inclusion_criteria,
                exclusion_criteria=payload.exclusion_criteria,
            ),
        )

        try:
            job_id = await self.job_service.enqueue_collection_screening(
                user_id=current_user["_id"],
                run_id=run["_id"],
                collection_id=collection_id,
                research_question=payload.research_question,
                inclusion_criteria=payload.inclusion_criteria,
                exclusion_criteria=payload.exclusion_criteria,
            )
            run = await self.screening_run_service.attach_job(
                run_id=run["_id"],
                user_id=current_user["_id"],
                job_id=job_id,
            )
        except Exception as exc:
            await self.screening_run_service.mark_failed(
                run_id=run["_id"],
                user_id=current_user["_id"],
                error_message=str(exc),
            )
            raise

        return StandardResponse(
            success=True,
            message="Screening encolado correctamente",
            data={
                "run_id": run["_id"],
                "job_id": job_id,
                "status": run["status"],
                "collection_id": run["collection_id"],
                "research_question": run["research_question"],
            },
        )

    async def get_results(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.screening_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )

        results = await self.screening_decision_service.list_run_decisions(
            user_id=current_user["_id"],
            run_id=run_id,
        )

        return StandardResponse(
            success=True,
            message="Resultados de screening recuperados correctamente",
            data={
                "results": results,
                "total": len(results),
                "run": run,
            },
        )

    async def list_runs(
        self,
        collection_id: str,
        current_user: dict,
    ) -> StandardResponse:
        exists = await self.collection_service.collection_exists(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        if not exists:
            raise NotFoundError("Colección no encontrada")

        runs = await self.screening_run_service.list_collection_runs(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        return StandardResponse(
            success=True,
            message="Screening runs recuperados correctamente",
            data={
                "runs": runs,
                "total": len(runs),
                "collection_id": collection_id,
            },
        )
