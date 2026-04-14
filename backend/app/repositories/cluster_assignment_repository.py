from typing import List, Optional

from pymongo import ASCENDING, ReturnDocument

from app.database import get_database


class ClusterAssignmentRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.cluster_assignments

    async def upsert(self, assignment_id: str, assignment_data: dict) -> dict:
        return await self.collection.find_one_and_update(
            {"_id": assignment_id},
            {"$set": assignment_data},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    async def find_by_id(self, assignment_id: str) -> Optional[dict]:
        return await self.collection.find_one({"_id": assignment_id})

    async def list_by_run(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> List[dict]:
        cursor = self.collection.find(
            {
                "id_user": user_id,
                "run_id": run_id,
            }
        ).sort([("cluster_id", ASCENDING), ("article_title", ASCENDING)])
        return await cursor.to_list(length=None)

    async def delete_by_run(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> int:
        result = await self.collection.delete_many(
            {
                "id_user": user_id,
                "run_id": run_id,
            }
        )
        return result.deleted_count

