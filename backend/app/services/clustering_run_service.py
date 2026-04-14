from datetime import datetime, timezone

from app.core import NotFoundError
from app.models import ClusteringRunData
from app.repositories import ClusteringRunRepository


class ClusteringRunService:
    def __init__(self):
        self.clustering_run_repo = ClusteringRunRepository()

    def _build_id(self) -> str:
        now = datetime.now(timezone.utc)
        return f"crun_{now.strftime('%Y%m%d%H%M%S%f')}"

    async def create_run(
        self,
        *,
        user_id: str,
        run_data: ClusteringRunData,
    ) -> dict:
        now = datetime.now(timezone.utc)
        run_id = self._build_id()
        document = run_data.model_dump()
        document["_id"] = run_id
        document["id_user"] = user_id
        document["created_at"] = now
        document["updated_at"] = now
        return await self.clustering_run_repo.upsert(run_id, document)

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
        return await self.clustering_run_repo.upsert(run_id, run)

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
        return await self.clustering_run_repo.upsert(run_id, run)

    async def mark_completed(
        self,
        *,
        run_id: str,
        user_id: str,
        total_articles: int,
        processed_articles: int,
        selected_cluster_count: int,
        algorithm_version: str | None,
        silhouette_score: float | None,
        clusters: list[dict],
    ) -> dict:
        run = await self.get_run(run_id=run_id, user_id=user_id)
        run["status"] = "completed"
        run["total_articles"] = total_articles
        run["processed_articles"] = processed_articles
        run["selected_cluster_count"] = selected_cluster_count
        run["algorithm_version"] = algorithm_version
        run["silhouette_score"] = silhouette_score
        run["clusters"] = clusters
        run["error_message"] = None
        run["updated_at"] = datetime.now(timezone.utc)
        run["finished_at"] = datetime.now(timezone.utc)
        return await self.clustering_run_repo.upsert(run_id, run)

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
        return await self.clustering_run_repo.upsert(run_id, run)

    async def get_run(self, *, run_id: str, user_id: str) -> dict:
        run = await self.clustering_run_repo.find_by_id(run_id)
        if not run or run.get("id_user") != user_id:
            raise NotFoundError("Clustering run no encontrado")
        return run

    async def list_collection_runs(self, *, user_id: str, collection_id: str) -> list[dict]:
        return await self.clustering_run_repo.list_by_collection(
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
        return await self.clustering_run_repo.delete(run_id)
