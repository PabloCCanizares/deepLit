"""
Servicio de jobs de backend.
"""
from datetime import datetime, timezone
from typing import Optional

from app.repositories import JobRepository


PDF_PROCESSING_JOB = "process_pdf"


class JobService:
    def __init__(self):
        self.job_repo = JobRepository()

    async def enqueue(
        self,
        *,
        job_type: str,
        payload: dict,
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
            payload={
                "pdf_id": pdf_id,
                "article_id": article_id,
                "user_id": user_id,
                "absolute_path": absolute_path,
                "filename": filename,
                "collection_id": collection_id,
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
