from datetime import datetime, timezone

from app.core import NotFoundError
from app.models import CollectionSynthesisData
from app.repositories import CollectionSynthesisRepository


class CollectionSynthesisService:
    def __init__(self):
        self.collection_synthesis_repo = CollectionSynthesisRepository()

    def _build_id(self) -> str:
        now = datetime.now(timezone.utc)
        return f"csyn_{now.strftime('%Y%m%d%H%M%S%f')}"

    async def create_run(
        self,
        *,
        user_id: str,
        run_data: CollectionSynthesisData,
    ) -> dict:
        now = datetime.now(timezone.utc)
        run_id = self._build_id()
        document = run_data.model_dump()
        document["_id"] = run_id
        document["id_user"] = user_id
        document["created_at"] = now
        document["updated_at"] = now
        return await self.collection_synthesis_repo.upsert(run_id, document)

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
        return await self.collection_synthesis_repo.upsert(run_id, run)

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
        return await self.collection_synthesis_repo.upsert(run_id, run)

    async def get_run(self, *, run_id: str, user_id: str) -> dict:
        run = await self.collection_synthesis_repo.find_by_id(run_id)
        if not run or run.get("id_user") != user_id:
            raise NotFoundError("Sintesis no encontrada")
        return run

    async def list_collection_runs(self, *, user_id: str, collection_id: str) -> list[dict]:
        return await self.collection_synthesis_repo.list_by_collection(
            user_id=user_id,
            collection_id=collection_id,
        )

    async def mark_completed(
        self,
        *,
        run_id: str,
        user_id: str,
        response: str,
        context_source: str | None,
        agent: str | None,
        prompt_version: str | None,
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["status"] = "completed"
        run["response"] = response
        run["context_source"] = context_source
        run["agent"] = agent
        run["prompt_version"] = prompt_version
        run["error_message"] = None
        run["updated_at"] = datetime.now(timezone.utc)
        run["finished_at"] = datetime.now(timezone.utc)
        return await self.collection_synthesis_repo.upsert(run_id, run)

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
        return await self.collection_synthesis_repo.upsert(run_id, run)

    async def save_paper(
        self,
        *,
        run_id: str,
        user_id: str,
        paper_response: str,
        paper_title: str | None,
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["paper_response"] = paper_response
        run["paper_title"] = paper_title
        run["updated_at"] = datetime.now(timezone.utc)
        return await self.collection_synthesis_repo.upsert(run_id, run)

    async def delete_run(
        self,
        *,
        run_id: str,
        user_id: str,
    ) -> bool:
        await self.get_run(run_id=run_id, user_id=user_id)
        return await self.collection_synthesis_repo.delete(run_id)
