from typing import Optional
from pydantic import BaseModel, Field


class KnowledgeGraphBackfillRequest(BaseModel):
    collection_id: Optional[str] = Field(
        default=None,
        description="ID de colección para limitar el backfill (opcional)",
    )
    limit: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="Número máximo de artículos a procesar",
    )
    reprocess: bool = Field(
        default=False,
        description="Si True, reprocesa artículos ya presentes en el grafo",
    )

