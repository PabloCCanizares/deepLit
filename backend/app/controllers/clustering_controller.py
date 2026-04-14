from fastapi import Depends

from app.core import ConflictError, NotFoundError, ValidationError, StandardResponse
from app.models import ClusteringRunData, ClusteringRunRequest
from app.services.cluster_assignment_service import ClusterAssignmentService
from app.services.clustering_run_service import ClusteringRunService
from app.services.collection_service import CollectionService
from app.services.evidence_extraction_run_service import EvidenceExtractionRunService
from app.services.job_service import JobService


class ClusteringController:
    def __init__(
        self,
        collection_service: CollectionService = Depends(),
        clustering_run_service: ClusteringRunService = Depends(),
        cluster_assignment_service: ClusterAssignmentService = Depends(),
        evidence_extraction_run_service: EvidenceExtractionRunService = Depends(),
        job_service: JobService = Depends(),
    ):
        self.collection_service = collection_service
        self.clustering_run_service = clustering_run_service
        self.cluster_assignment_service = cluster_assignment_service
        self.evidence_extraction_run_service = evidence_extraction_run_service
        self.job_service = job_service

    async def run_clustering(
        self,
        collection_id: str,
        payload: ClusteringRunRequest,
        current_user: dict,
    ) -> StandardResponse:
        exists = await self.collection_service.collection_exists(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        if not exists:
            raise NotFoundError("Coleccion no encontrada")

        evidence_run = await self.evidence_extraction_run_service.get_run(
            run_id=payload.evidence_extraction_run_id,
            user_id=current_user["_id"],
        )
        if evidence_run.get("collection_id") != collection_id:
            raise ValidationError(
                "La evidence extraction seleccionada no pertenece a la coleccion activa"
            )
        if evidence_run.get("status") != "completed":
            raise ConflictError(
                "Solo puedes usar evidence extractions completadas para clustering"
            )

        run = await self.clustering_run_service.create_run(
            user_id=current_user["_id"],
            run_data=ClusteringRunData(
                collection_id=collection_id,
                evidence_extraction_run_id=payload.evidence_extraction_run_id,
                requested_cluster_count=payload.cluster_count,
            ),
        )

        try:
            job_id = await self.job_service.enqueue_clustering(
                user_id=current_user["_id"],
                run_id=run["_id"],
                collection_id=collection_id,
                evidence_extraction_run_id=payload.evidence_extraction_run_id,
                requested_cluster_count=payload.cluster_count,
            )
            run = await self.clustering_run_service.attach_job(
                run_id=run["_id"],
                user_id=current_user["_id"],
                job_id=job_id,
            )
        except Exception as exc:
            await self.clustering_run_service.mark_failed(
                run_id=run["_id"],
                user_id=current_user["_id"],
                error_message=str(exc),
            )
            raise

        return StandardResponse(
            success=True,
            message="Clustering encolado correctamente",
            data={
                "run_id": run["_id"],
                "job_id": job_id,
                "status": run["status"],
                "collection_id": run["collection_id"],
                "evidence_extraction_run_id": run["evidence_extraction_run_id"],
                "requested_cluster_count": run.get("requested_cluster_count"),
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

        runs = await self.clustering_run_service.list_collection_runs(
            user_id=current_user["_id"],
            collection_id=collection_id,
        )
        return StandardResponse(
            success=True,
            message="Clustering runs recuperados correctamente",
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
        run = await self.clustering_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        assignments = await self.cluster_assignment_service.list_run_assignments(
            user_id=current_user["_id"],
            run_id=run_id,
        )
        return StandardResponse(
            success=True,
            message="Resultados de clustering recuperados correctamente",
            data={
                "results": assignments,
                "total": len(assignments),
                "run": run,
            },
        )

    async def delete_run(
        self,
        run_id: str,
        current_user: dict,
    ) -> StandardResponse:
        run = await self.clustering_run_service.get_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )
        if run.get("status") in {"queued", "processing"}:
            raise ConflictError("No puedes eliminar un clustering que sigue en cola o en procesamiento")

        await self.cluster_assignment_service.delete_run_assignments(
            user_id=current_user["_id"],
            run_id=run_id,
        )
        await self.clustering_run_service.delete_run(
            run_id=run_id,
            user_id=current_user["_id"],
        )

        return StandardResponse(
            success=True,
            message="Clustering eliminado correctamente",
            data={
                "run_id": run_id,
                "deleted": True,
            },
        )
