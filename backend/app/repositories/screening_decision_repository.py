from typing import List, Optional

from pymongo import ASCENDING, ReturnDocument

from app.database import get_database


class ScreeningDecisionRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.screening_decisions

    async def upsert(self, decision_id: str, decision_data: dict) -> dict:
        return await self.collection.find_one_and_update(
            {"_id": decision_id},
            {"$set": decision_data},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

    async def find_by_id(self, decision_id: str) -> Optional[dict]:
        return await self.collection.find_one({"_id": decision_id})

    async def list_by_run(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> List[dict]:
        filter_query = {
            "id_user": user_id,
            "run_id": run_id,
        }

        cursor = self.collection.find(filter_query).sort("updated_at", ASCENDING)
        return await cursor.to_list(length=None)

    async def delete_by_run(
        self,
        *,
        user_id: str,
        run_id: str,
    ) -> int:
        result = await self.collection.delete_many({
            "id_user": user_id,
            "run_id": run_id,
        })
        return result.deleted_count
