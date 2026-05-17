from fastapi import Depends

from app.core import ConflictError, NotFoundError, StandardResponse
from app.models import (
    CollectionSynthesisData,
    CollectionSynthesisRunRequest,
)
from app.services.collection_service import CollectionService
from app.services.collection_synthesis_service import CollectionSynthesisService
from app.services.collection_synthesis_run_service import CollectionSynthesisRunService
from app.services.job_service import JobService


class CollectionSynthesisController:
    def __init__(
        self,
        collection_service: CollectionService = Depends(),
        collection_synthesis_service: CollectionSynthesisService = Depends(),
        collection_synthesis_run_service: CollectionSynthesisRunService = Depends(),
        job_service: JobService = Depends(),
    ):
        self.collection_service = collection_service
        self.collection_synthesis_service = collection_synthesis_service
        self.collection_synthesis_run_service = collection_synthesis_run_service
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

        await self.collection_synthesis_service.ensure_collection_has_processed_pdfs(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )

        run = await self.collection_synthesis_run_service.create_run(
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
            run = await self.collection_synthesis_run_service.attach_job(
                run_id=run["_id"],
                user_id=current_user["_id"],
                job_id=job_id,
            )
        except Exception as exc:
            await self.collection_synthesis_run_service.mark_failed(
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

        runs = await self.collection_synthesis_run_service.list_collection_runs(
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

    async def generate_paper(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.collection_synthesis_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        if run.get("status") != "completed" or not run.get("response"):
            raise ConflictError("Solo puedes preparar un paper a partir de una sintesis completada")

        paper_result = await self.collection_synthesis_service.generate_paper(
            user_id=current_user["_id"],
            collection_id=run["collection_id"],
            original_prompt=run["prompt"],
            synthesis_response=run["response"],
        )
        run = await self.collection_synthesis_run_service.save_paper(
            run_id=run_id,
            user_id=current_user["_id"],
            paper_response=paper_result["paper_response"],
            paper_title=paper_result["paper_title"],
        )

        return StandardResponse(
            success=True,
            message="Version paper generada correctamente",
            data={
                "run": run,
            },
        )

    async def delete_run(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.collection_synthesis_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        if run.get("status") in {"queued", "processing"}:
            raise ConflictError("No puedes eliminar una sintesis que sigue en cola o en procesamiento")

        await self.collection_synthesis_run_service.delete_run(
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
