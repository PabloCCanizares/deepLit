"""
Repositorio de jobs de backend.
"""
from datetime import datetime, timezone
from typing import Optional

from pymongo import ASCENDING, ReturnDocument

from app.database import get_database


class JobRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.jobs

    async def create(self, job_data: dict) -> str:
        result = await self.collection.insert_one(job_data)
        return job_data.get("_id") or str(result.inserted_id)

    async def claim_next(self, job_type: Optional[str] = None) -> Optional[dict]:
        filter_query = {"status": "queued"}
        if job_type:
            filter_query["type"] = job_type

        now = datetime.now(timezone.utc)
        return await self.collection.find_one_and_update(
            filter_query,
            {
                "$set": {
                    "status": "processing",
                    "started_at": now,
                    "updated_at": now,
                },
                "$inc": {"attempts": 1},
            },
            sort=[("created_at", ASCENDING)],
            return_document=ReturnDocument.AFTER,
        )

    async def mark_completed(self, job_id: str) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        return await self.collection.find_one_and_update(
            {"_id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "finished_at": now,
                    "updated_at": now,
                    "error_message": None,
                }
            },
            return_document=ReturnDocument.AFTER,
        )

    async def mark_failed(self, job_id: str, error_message: str) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        return await self.collection.find_one_and_update(
            {"_id": job_id},
            {
                "$set": {
                    "status": "failed",
                    "finished_at": now,
                    "updated_at": now,
                    "error_message": error_message,
                }
            },
            return_document=ReturnDocument.AFTER,
        )

    async def requeue_processing_jobs(self, job_type: Optional[str] = None) -> int:
        filter_query = {"status": "processing"}
        if job_type:
            filter_query["type"] = job_type

        now = datetime.now(timezone.utc)
        result = await self.collection.update_many(
            filter_query,
            {
                "$set": {
                    "status": "queued",
                    "started_at": None,
                    "updated_at": now,
                }
            },
        )
        return result.modified_count

    async def find_latest_job_by_payload_field(
        self,
        *,
        payload_field: str,
        payload_value: str,
        job_type: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[dict]:
        filter_query = {
            f"payload.{payload_field}": payload_value,
        }

        if job_type:
            filter_query["type"] = job_type
        if user_id:
            filter_query["id_user"] = user_id

        return await self.collection.find_one(
            filter_query,
            sort=[("created_at", -1)],
        )
