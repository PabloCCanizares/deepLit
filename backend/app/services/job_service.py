"""
Servicio de jobs de backend.
"""
from datetime import datetime, timezone
from typing import Optional

from app.repositories import JobRepository


PDF_PROCESSING_JOB = "process_pdf"
COLLECTION_SCREENING_JOB = "screen_collection"
COLLECTION_SYNTHESIS_JOB = "synthesize_collection"
EVIDENCE_EXTRACTION_JOB = "extract_evidence"
CLUSTERING_JOB = "cluster_evidence"


class JobService:
    def __init__(self):
        self.job_repo = JobRepository()

    async def enqueue(
        self,
        *,
        job_type: str,
        payload: dict,
        user_id: str | None = None,
    ) -> str:
        created_at = datetime.now(timezone.utc)
        job_id = f"{job_type}_{created_at.strftime('%Y%m%d%H%M%S%f')}"
        job_dict = {
            "_id": job_id,
            "type": job_type,
            "status": "queued",
            "attempts": 0,
            "created_at": created_at,
            "updated_at": created_at,
            "started_at": None,
            "finished_at": None,
            "error_message": None,
            "payload": payload,
        }
        if user_id:
            job_dict["id_user"] = user_id
        return await self.job_repo.create(job_dict)

    async def enqueue_pdf_processing(
        self,
        *,
        pdf_id: str,
        article_id: str,
        user_id: str,
        absolute_path: str,
        filename: str,
        collection_id: Optional[str] = None,
    ) -> str:
        return await self.enqueue(
            job_type=PDF_PROCESSING_JOB,
            user_id=user_id,
            payload={
                "pdf_id": pdf_id,
                "article_id": article_id,
                "user_id": user_id,
                "absolute_path": absolute_path,
                "filename": filename,
                "collection_id": collection_id,
            },
        )

    async def enqueue_collection_screening(
        self,
        *,
        user_id: str,
        run_id: str,
        collection_id: str,
        research_question: str,
        inclusion_criteria: list[str] | None = None,
        exclusion_criteria: list[str] | None = None,
    ) -> str:
        return await self.enqueue(
            job_type=COLLECTION_SCREENING_JOB,
            user_id=user_id,
            payload={
                "user_id": user_id,
                "run_id": run_id,
                "collection_id": collection_id,
                "research_question": research_question,
                "inclusion_criteria": inclusion_criteria or [],
                "exclusion_criteria": exclusion_criteria or [],
            },
        )

    async def enqueue_collection_synthesis(
        self,
        *,
        user_id: str,
        run_id: str,
        collection_id: str,
        prompt: str,
    ) -> str:
        return await self.enqueue(
            job_type=COLLECTION_SYNTHESIS_JOB,
            user_id=user_id,
            payload={
                "user_id": user_id,
                "run_id": run_id,
                "collection_id": collection_id,
                "prompt": prompt,
            },
        )

    async def enqueue_evidence_extraction(
        self,
        *,
        user_id: str,
        run_id: str,
        collection_id: str,
        screening_run_id: str | None = None,
        selection_mode: str = "all",
    ) -> str:
        return await self.enqueue(
            job_type=EVIDENCE_EXTRACTION_JOB,
            user_id=user_id,
            payload={
                "user_id": user_id,
                "run_id": run_id,
                "collection_id": collection_id,
                "screening_run_id": screening_run_id,
                "selection_mode": selection_mode,
            },
        )

    async def enqueue_clustering(
        self,
        *,
        user_id: str,
        run_id: str,
        collection_id: str,
        evidence_extraction_run_id: str,
        requested_cluster_count: int | None = None,
    ) -> str:
        return await self.enqueue(
            job_type=CLUSTERING_JOB,
            user_id=user_id,
            payload={
                "user_id": user_id,
                "run_id": run_id,
                "collection_id": collection_id,
                "evidence_extraction_run_id": evidence_extraction_run_id,
                "requested_cluster_count": requested_cluster_count,
            },
        )

    async def claim_next(self, job_type: Optional[str] = None) -> Optional[dict]:
        return await self.job_repo.claim_next(job_type=job_type)

    async def mark_completed(self, job_id: str) -> Optional[dict]:
        return await self.job_repo.mark_completed(job_id)

    async def mark_failed(self, job_id: str, error_message: str) -> Optional[dict]:
        return await self.job_repo.mark_failed(job_id, error_message)

    async def requeue_processing_jobs(self, job_type: Optional[str] = None) -> int:
        return await self.job_repo.requeue_processing_jobs(job_type=job_type)
