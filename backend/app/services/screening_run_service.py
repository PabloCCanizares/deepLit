from datetime import datetime, timezone

from app.core import NotFoundError
from app.models import ScreeningRunCounts, ScreeningRunData
from app.repositories import ScreeningRunRepository


class ScreeningRunService:
    def __init__(self):
        self.screening_run_repo = ScreeningRunRepository()

    def _build_id(self) -> str:
        now = datetime.now(timezone.utc)
        return f"srun_{now.strftime('%Y%m%d%H%M%S%f')}"

    async def create_run(
        self,
        *,
        user_id: str,
        run_data: ScreeningRunData,
    ) -> dict:
        now = datetime.now(timezone.utc)
        run_id = self._build_id()
        document = run_data.model_dump()
        document["_id"] = run_id
        document["id_user"] = user_id
        document["created_at"] = now
        document["updated_at"] = now
        return await self.screening_run_repo.upsert(run_id, document)

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
        return await self.screening_run_repo.upsert(run_id, run)

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
        return await self.screening_run_repo.upsert(run_id, run)

    async def mark_completed(
        self,
        *,
        run_id: str,
        user_id: str,
        total_articles: int,
        processed_articles: int,
        counts: dict,
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["status"] = "completed"
        run["total_articles"] = total_articles
        run["processed_articles"] = processed_articles
        run["counts"] = ScreeningRunCounts(**counts).model_dump()
        run["error_message"] = None
        run["updated_at"] = datetime.now(timezone.utc)
        run["finished_at"] = datetime.now(timezone.utc)
        return await self.screening_run_repo.upsert(run_id, run)

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
        return await self.screening_run_repo.upsert(run_id, run)

    async def get_run(self, *, run_id: str, user_id: str) -> dict:
        run = await self.screening_run_repo.find_by_id(run_id)
        if not run or run.get("id_user") != user_id:
            raise NotFoundError("Screening run no encontrado")
        return run

    async def list_collection_runs(self, *, user_id: str, collection_id: str) -> list[dict]:
        return await self.screening_run_repo.list_by_collection(
            user_id=user_id,
            collection_id=collection_id,
        )
