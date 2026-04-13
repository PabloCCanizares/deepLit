from datetime import datetime, timezone

from app.core import NotFoundError
from app.models import EvidenceExtractionRunData
from app.repositories import EvidenceExtractionRunRepository


class EvidenceExtractionRunService:
    def __init__(self):
        self.evidence_extraction_run_repo = EvidenceExtractionRunRepository()

    def _build_id(self) -> str:
        now = datetime.now(timezone.utc)
        return f"erun_{now.strftime('%Y%m%d%H%M%S%f')}"

    async def create_run(
        self,
        *,
        user_id: str,
        run_data: EvidenceExtractionRunData,
    ) -> dict:
        now = datetime.now(timezone.utc)
        run_id = self._build_id()
        document = run_data.model_dump()
        document["_id"] = run_id
        document["id_user"] = user_id
        document["created_at"] = now
        document["updated_at"] = now
        return await self.evidence_extraction_run_repo.upsert(run_id, document)

    async def attach_job(
        self,
        *,
        run_id: str,
        user_id: str,
        job_id: str,
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["job_id"] = job_id
        run["updated_at"] = datetime.now(timezone.utc)
        return await self.evidence_extraction_run_repo.upsert(run_id, run)

    async def mark_processing(
        self,
        *,
        run_id: str,
        user_id: str,
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["status"] = "processing"
        run["error_message"] = None
        run["updated_at"] = datetime.now(timezone.utc)
        return await self.evidence_extraction_run_repo.upsert(run_id, run)

    async def mark_completed(
        self,
        *,
        run_id: str,
        user_id: str,
        total_articles: int,
        processed_articles: int,
        prompt_version: str | None,
        schema_version: str | None,
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["status"] = "completed"
        run["total_articles"] = total_articles
        run["processed_articles"] = processed_articles
        run["prompt_version"] = prompt_version
        run["schema_version"] = schema_version
        run["error_message"] = None
        run["updated_at"] = datetime.now(timezone.utc)
        run["finished_at"] = datetime.now(timezone.utc)
        return await self.evidence_extraction_run_repo.upsert(run_id, run)

    async def mark_failed(
        self,
        *,
        run_id: str,
        user_id: str,
        error_message: str,
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["status"] = "failed"
        run["error_message"] = error_message
        run["updated_at"] = datetime.now(timezone.utc)
        run["finished_at"] = datetime.now(timezone.utc)
        return await self.evidence_extraction_run_repo.upsert(run_id, run)

    async def get_run(self, *, run_id: str, user_id: str) -> dict:
        run = await self.evidence_extraction_run_repo.find_by_id(run_id)
        if not run or run.get("id_user") != user_id:
            raise NotFoundError("Evidence extraction run no encontrado")
        return run

    async def list_collection_runs(self, *, user_id: str, collection_id: str) -> list[dict]:
        return await self.evidence_extraction_run_repo.list_by_collection(
            user_id=user_id,
            collection_id=collection_id,
        )

    async def delete_run(
        self,
        *,
        run_id: str,
        user_id: str,
    ) -> bool:
        await self.get_run(run_id=run_id, user_id=user_id)
        return await self.evidence_extraction_run_repo.delete(run_id)
