from typing import Optional

from fastapi import Depends

from app.core import ConflictError, NotFoundError, StandardResponse
from app.models import RedactionRunData, RedactionRunRequest
from app.services.collection_service import CollectionService
from app.services.job_service import JobService
from app.services.redaction_run_service import RedactionRunService
from app.services.redaction_service import RedactionService


class RedactionController:
    def __init__(
        self,
        collection_service: CollectionService = Depends(),
        redaction_run_service: RedactionRunService = Depends(),
        job_service: JobService = Depends(),
    ):
        self.collection_service = collection_service
        self.redaction_run_service = redaction_run_service
        self.job_service = job_service
        self.redaction_service = RedactionService()

    async def run_redaction(
        self,
        collection_id: str,
        payload: RedactionRunRequest,
        current_user: dict,
    ) -> StandardResponse:
        user_id = current_user["_id"]

        exists = await self.collection_service.collection_exists(
            user_id=user_id,
            collection_id=collection_id,
        )
        if not exists:
            raise NotFoundError("Coleccion no encontrada")

        await self.redaction_service.ensure_collection_has_processed_pdfs(
            user_id=user_id,
            collection_id=collection_id,
        )
        await self.redaction_service.validate_referenced_artifacts(
            user_id=user_id,
            request=payload,
        )

        run = await self.redaction_run_service.create_run(
            user_id=user_id,
            run_data=RedactionRunData(
                collection_id=collection_id,
                parent_run_id=payload.parent_run_id,
                user_idea=payload.user_idea,
                text_type=payload.text_type,
                source_synthesis_run_id=payload.synthesis_run_id,
                source_evidence_extraction_run_id=payload.evidence_extraction_run_id,
            ),
        )

        try:
            job_id = await self.job_service.enqueue_redaction(
                user_id=user_id,
                run_id=run["_id"],
                collection_id=collection_id,
                user_idea=payload.user_idea,
                text_type=payload.text_type,
                synthesis_run_id=payload.synthesis_run_id,
                evidence_extraction_run_id=payload.evidence_extraction_run_id,
                parent_run_id=payload.parent_run_id,
            )
            run = await self.redaction_run_service.attach_job(
                run_id=run["_id"],
                user_id=user_id,
                job_id=job_id,
            )
        except Exception as exc:
            await self.redaction_run_service.mark_failed(
                run_id=run["_id"],
                user_id=user_id,
                error_message=str(exc),
            )
            raise

        return StandardResponse(
            success=True,
            message="Redaccion encolada correctamente",
            data={
                "run_id": run["_id"],
                "job_id": run.get("job_id"),
                "status": run["status"],
                "collection_id": run["collection_id"],
            },
        )

    async def list_runs(
        self,
        collection_id: str,
        current_user: dict,
        parent_run_id: Optional[str] = None,
    ) -> StandardResponse:
        exists = await self.collection_service.collection_exists(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        if not exists:
            raise NotFoundError("Coleccion no encontrada")

        runs = await self.redaction_run_service.list_collection_runs(
            user_id=current_user["_id"],
            collection_id=collection_id,
            parent_run_id=parent_run_id,
        )

        return StandardResponse(
            success=True,
            message="Redacciones recuperadas correctamente",
            data={
                "runs": runs,
                "total": len(runs),
                "collection_id": collection_id,
                "parent_run_id": parent_run_id,
            },
        )

    async def get_run(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.redaction_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        return StandardResponse(
            success=True,
            message="Redaccion recuperada correctamente",
            data={"run": run},
        )

    async def delete_run(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.redaction_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        if run.get("status") in {"queued", "processing"}:
            raise ConflictError(
                "No puedes eliminar una redaccion que sigue en cola o en procesamiento"
            )

        await self.redaction_run_service.delete_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )

        return StandardResponse(
            success=True,
            message="Redaccion eliminada correctamente",
            data={
                "run_id": run_id,
                "deleted": True,
            },
        )
