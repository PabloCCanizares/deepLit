from typing import List, Optional

from pymongo import DESCENDING, ReturnDocument

from app.database import get_database


class ClusteringRunRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.clustering_runs

    async def upsert(self, run_id: str, run_data: dict) -> dict:
        return await self.collection.find_one_and_update(
            {"_id": run_id},
            {"$set": run_data},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    async def find_by_id(self, run_id: str) -> Optional[dict]:
        return await self.collection.find_one({"_id": run_id})

    async def list_by_collection(
        self,
        *,
        user_id: str,
        collection_id: str,
    ) -> List[dict]:
        cursor = self.collection.find(
            {
                "id_user": user_id,
                "collection_id": collection_id,
            }
        ).sort("updated_at", DESCENDING)
        return await cursor.to_list(length=None)

    async def delete(self, run_id: str) -> bool:
        result = await self.collection.delete_one({"_id": run_id})
        return result.deleted_count > 0

