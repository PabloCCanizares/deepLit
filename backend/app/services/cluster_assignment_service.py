from datetime import datetime, timezone

from app.models import ClusterAssignmentData
from app.repositories import ClusterAssignmentRepository


class ClusterAssignmentService:
    def __init__(self):
        self.cluster_assignment_repo = ClusterAssignmentRepository()

    def _build_id(
        self,
        *,
        run_id: str,
        article_id: str,
    ) -> str:
        return f"{run_id}:{article_id}"

    async def save_assignment(
        self,
        *,
        user_id: str,
        assignment_data: ClusterAssignmentData,
    ) -> dict:
        now = datetime.now(timezone.utc)
        assignment_id = self._build_id(
            run_id=assignment_data.run_id,
            article_id=assignment_data.article_id,
        )
        current = await self.cluster_assignment_repo.find_by_id(assignment_id)

        document = assignment_data.model_dump()
        document["_id"] = assignment_id
        document["id_user"] = user_id
        document["updated_at"] = now
        document["created_at"] = current.get("created_at", now) if current else now
        return await self.cluster_assignment_repo.upsert(assignment_id, document)

    async def list_run_assignments(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> list[dict]:
        return await self.cluster_assignment_repo.list_by_run(
            user_id=user_id,
            run_id=run_id,
        )

    async def delete_run_assignments(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> int:
        return await self.cluster_assignment_repo.delete_by_run(
            user_id=user_id,
            run_id=run_id,
        )
