from fastapi import Depends

from app.core import ConflictError, NotFoundError, ValidationError, StandardResponse
from app.models import EvidenceExtractionRunData, EvidenceExtractionRunRequest
from app.services.article_extraction_service import ArticleExtractionService
from app.services.collection_service import CollectionService
from app.services.evidence_extraction_run_service import EvidenceExtractionRunService
from app.services.job_service import JobService
from app.services.screening_run_service import ScreeningRunService


class EvidenceExtractionController:
    def __init__(
        self,
        collection_service: CollectionService = Depends(),
        evidence_extraction_run_service: EvidenceExtractionRunService = Depends(),
        article_extraction_service: ArticleExtractionService = Depends(),
        screening_run_service: ScreeningRunService = Depends(),
        job_service: JobService = Depends(),
    ):
        self.collection_service = collection_service
        self.evidence_extraction_run_service = evidence_extraction_run_service
        self.article_extraction_service = article_extraction_service
        self.screening_run_service = screening_run_service
        self.job_service = job_service

    async def run_extraction(
        self,
        collection_id: str,
        payload: EvidenceExtractionRunRequest,
        current_user: dict,
    ) -> StandardResponse:
        screening_run_id = payload.screening_run_id
        if payload.selection_mode == "all":
            screening_run_id = None

        exists = await self.collection_service.collection_exists(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        if not exists:
            raise NotFoundError("Coleccion no encontrada")

        if payload.selection_mode != "all" and not screening_run_id:
            raise ValidationError("Debes seleccionar un screening para este modo de extraccion")

        if screening_run_id:
            screening_run = await self.screening_run_service.get_run(
                run_id=screening_run_id,
                user_id=current_user["_id"],
            )
            if screening_run.get("collection_id") != collection_id:
                raise ValidationError("El screening seleccionado no pertenece a la coleccion activa")
            if screening_run.get("status") != "completed":
                raise ConflictError("Solo puedes usar screenings completados para acotar la extraccion")

        run = await self.evidence_extraction_run_service.create_run(
            user_id=current_user["_id"],
            run_data=EvidenceExtractionRunData(
                collection_id=collection_id,
                screening_run_id=screening_run_id,
                selection_mode=payload.selection_mode,
            ),
        )

        try:
            job_id = await self.job_service.enqueue_evidence_extraction(
                user_id=current_user["_id"],
                run_id=run["_id"],
                collection_id=collection_id,
                screening_run_id=screening_run_id,
                selection_mode=payload.selection_mode,
            )
            run = await self.evidence_extraction_run_service.attach_job(
                run_id=run["_id"],
                user_id=current_user["_id"],
                job_id=job_id,
            )
        except Exception as exc:
            await self.evidence_extraction_run_service.mark_failed(
                run_id=run["_id"],
                user_id=current_user["_id"],
                error_message=str(exc),
            )
            raise

        return StandardResponse(
            success=True,
            message="Extraccion de evidencia encolada correctamente",
            data={
                "run_id": run["_id"],
                "job_id": job_id,
                "status": run["status"],
                "collection_id": run["collection_id"],
                "selection_mode": run["selection_mode"],
                "screening_run_id": run.get("screening_run_id"),
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

        runs = await self.evidence_extraction_run_service.list_collection_runs(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        return StandardResponse(
            success=True,
            message="Evidence extraction runs recuperados correctamente",
            data={
                "runs": runs,
                "total": len(runs),
                "collection_id": collection_id,
            },
        )

    async def get_results(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.evidence_extraction_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        results = await self.article_extraction_service.list_run_extractions(
            user_id=current_user["_id"],
            run_id=run_id,
        )
        return StandardResponse(
            success=True,
            message="Resultados de evidence extraction recuperados correctamente",
            data={
                "results": results,
                "total": len(results),
                "run": run,
            },
        )

    async def delete_run(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.evidence_extraction_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        if run.get("status") in {"queued", "processing"}:
            raise ConflictError("No puedes eliminar una extraccion que sigue en cola o en procesamiento")

        await self.article_extraction_service.delete_run_extractions(
            user_id=current_user["_id"],
            run_id=run_id,
        )
        await self.evidence_extraction_run_service.delete_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )

        return StandardResponse(
            success=True,
            message="Evidence extraction eliminada correctamente",
            data={
                "run_id": run_id,
                "deleted": True,
            },
        )
