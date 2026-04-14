from typing import Optional

from pydantic import BaseModel, Field


class ClusteringRunRequest(BaseModel):
    evidence_extraction_run_id: str = Field(
        ...,
        min_length=1,
        description="Run de evidence extraction sobre el que se ejecuta el clustering.",
    )
    cluster_count: Optional[int] = Field(
        None,
        ge=2,
        le=8,
        description="Numero deseado de clusters. Si no se indica, se estima automaticamente.",
    )


class ClusterSummary(BaseModel):
    cluster_id: str = Field(..., description="ID interno del cluster dentro del run.")
    label: str = Field(..., min_length=1, description="Etiqueta legible del cluster.")
    summary: str = Field(..., min_length=1, description="Resumen breve del cluster.")
    size: int = Field(..., ge=0, description="Numero de articulos en el cluster.")
    keywords: list[str] = Field(
        default_factory=list,
        description="Terminos representativos del cluster.",
    )

