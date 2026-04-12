from datetime import datetime, timezone

from app.models import ScreeningDecisionData
from app.core import NotFoundError
from app.repositories import ScreeningDecisionRepository


class ScreeningDecisionService:
    def __init__(self):
        self.screening_repo = ScreeningDecisionRepository()

    def _build_id(
        self,
        *,
        run_id: str,
        article_id: str,
    ) -> str:
        return f"{run_id}:{article_id}"

    async def save_decision(
        self,
        *,
        user_id: str,
        decision_data: ScreeningDecisionData,
    ) -> dict:
        now = datetime.now(timezone.utc)
        decision_id = self._build_id(
            run_id=decision_data.run_id,
            article_id=decision_data.article_id,
        )
        current = await self.screening_repo.find_by_id(decision_id)

        document = decision_data.model_dump()
        document["_id"] = decision_id
        document["id_user"] = user_id
        document["updated_at"] = now
        document["created_at"] = current.get("created_at", now) if current else now

        return await self.screening_repo.upsert(decision_id, document)

    async def list_run_decisions(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> list[dict]:
        return await self.screening_repo.list_by_run(
            user_id=user_id,
            run_id=run_id,
        )

    async def update_decision(
        self,
        *,
        user_id: str,
        run_id: str,
        article_id: str,
        decision: str,
        reason: str | None = None,
    ) -> dict:
        decision_id = self._build_id(
            run_id=run_id,
            article_id=article_id,
        )
        current = await self.screening_repo.find_by_id(decision_id)

        if not current or current.get("id_user") != user_id:
            raise NotFoundError("Resultado de screening no encontrado")

        current["decision"] = decision
        if reason:
            current["reason"] = reason
        current["updated_at"] = datetime.now(timezone.utc)

        return await self.screening_repo.upsert(decision_id, current)

    async def delete_run_decisions(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> int:
        return await self.screening_repo.delete_by_run(
            user_id=user_id,
            run_id=run_id,
        )
