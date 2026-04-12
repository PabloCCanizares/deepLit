from fastapi import Depends

from app.core import NotFoundError, StandardResponse
from app.models import (
    CollectionSynthesisData,
    CollectionSynthesisPaperRequest,
    CollectionSynthesisRunRequest,
)
from app.services.collection_service import CollectionService
from app.services.collection_synthesis_service import CollectionSynthesisService
from app.services.job_service import JobService


class CollectionResearcherController:
    def __init__(
        self,
        collection_service: CollectionService = Depends(),
        collection_synthesis_service: CollectionSynthesisService = Depends(),
        job_service: JobService = Depends(),
    ):
        self.collection_service = collection_service
        self.collection_synthesis_service = collection_synthesis_service
        self.job_service = job_service

    async def run_synthesis(
        self,
        collection_id: str,
        payload: CollectionSynthesisRunRequest,
        current_user: dict,
    ) -> StandardResponse:
        exists = await self.collection_service.collection_exists(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        if not exists:
            raise NotFoundError("Coleccion no encontrada")

        run = await self.collection_synthesis_service.create_run(
            user_id=current_user["_id"],
            run_data=CollectionSynthesisData(
                collection_id=collection_id,
                prompt=payload.prompt,
            ),
        )

        try:
            job_id = await self.job_service.enqueue_collection_synthesis(
                user_id=current_user["_id"],
                run_id=run["_id"],
                collection_id=collection_id,
                prompt=payload.prompt,
            )
            run = await self.collection_synthesis_service.attach_job(
                run_id=run["_id"],
                user_id=current_user["_id"],
                job_id=job_id,
            )
        except Exception as exc:
            await self.collection_synthesis_service.mark_failed(
                run_id=run["_id"],
                user_id=current_user["_id"],
                error_message=str(exc),
            )
            raise

        return StandardResponse(
            success=True,
            message="Sintesis encolada correctamente",
            data={
                "run": run,
                "job_id": run.get("job_id"),
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
            raise NotFoundError("Coleccion no encontrada")

        runs = await self.collection_synthesis_service.list_collection_runs(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )

        return StandardResponse(
            success=True,
            message="Sintesis recuperadas correctamente",
            data={
                "runs": runs,
                "total": len(runs),
                "collection_id": collection_id,
            },
        )

    async def save_paper(
        self,
        run_id: str,
        payload: CollectionSynthesisPaperRequest,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.collection_synthesis_service.save_paper(
            run_id=run_id,
            user_id=current_user["_id"],
            paper_response=payload.paper_response,
            paper_title=payload.paper_title,
        )

        return StandardResponse(
            success=True,
            message="Version paper guardada correctamente",
            data={
                "run": run,
            },
        )

    async def delete_run(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        await self.collection_synthesis_service.delete_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )

        return StandardResponse(
            success=True,
            message="Sintesis eliminada correctamente",
            data={
                "run_id": run_id,
                "deleted": True,
            },
        )
