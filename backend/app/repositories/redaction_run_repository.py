from typing import List, Optional

from pymongo import DESCENDING, ReturnDocument

from app.database import get_database


class RedactionRunRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.redaction_runs

    async def upsert(self, run_id: str, run_data: dict) -> dict:
        return await self.collection.find_one_and_update(
            {"_id": run_id},
            {"$set": run_data},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    async def find_by_id(self, run_id: str) -> Optional[dict]:
        return await self.collection.find_one({"_id": run_id})

    async def delete(self, run_id: str) -> bool:
        result = await self.collection.delete_one({"_id": run_id})
        return result.deleted_count > 0

    async def list_by_collection(
        self,
        *,
        user_id: str,
        collection_id: str,
        parent_run_id: Optional[str] = None,
    ) -> List[dict]:
        query = {
            "id_user": user_id,
            "collection_id": collection_id,
        }
        if parent_run_id is not None:
            query["parent_run_id"] = parent_run_id

        cursor = self.collection.find(query).sort("created_at", DESCENDING)
        return await cursor.to_list(length=None)
