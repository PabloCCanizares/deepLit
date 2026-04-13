from datetime import datetime, timezone

from app.models import ArticleExtractionData
from app.repositories import ArticleExtractionRepository


class ArticleExtractionService:
    def __init__(self):
        self.article_extraction_repo = ArticleExtractionRepository()

    def _build_id(
        self,
        *,
        run_id: str,
        article_id: str,
    ) -> str:
        return f"{run_id}:{article_id}"

    async def save_extraction(
        self,
        *,
        user_id: str,
        extraction_data: ArticleExtractionData,
    ) -> dict:
        now = datetime.now(timezone.utc)
        extraction_id = self._build_id(
            run_id=extraction_data.run_id,
            article_id=extraction_data.article_id,
        )
        current = await self.article_extraction_repo.find_by_id(extraction_id)

        document = extraction_data.model_dump()
        document["_id"] = extraction_id
        document["id_user"] = user_id
        document["updated_at"] = now
        document["created_at"] = current.get("created_at", now) if current else now

        return await self.article_extraction_repo.upsert(extraction_id, document)

    async def list_run_extractions(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> list[dict]:
        return await self.article_extraction_repo.list_by_run(
            user_id=user_id,
            run_id=run_id,
        )

    async def delete_run_extractions(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> int:
        return await self.article_extraction_repo.delete_by_run(
            user_id=user_id,
            run_id=run_id,
        )
