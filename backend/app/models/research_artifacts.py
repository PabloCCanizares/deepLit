from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ScreeningDecisionData(BaseModel):
    run_id: str = Field(..., description="ID de la ejecucion de screening.")
    article_id: str = Field(..., description="ID del articulo evaluado.")
    article_title: Optional[str] = Field(None, description="Titulo del articulo evaluado.")
    decision: Literal["include", "review", "exclude"] = Field(
        ...,
        description="Decision de cribado para el articulo.",
    )
    reason: str = Field(..., min_length=1, description="Justificacion breve de la decision.")
    confidence: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Confianza estimada en el rango 0-1.",
    )
    source_type: Literal["full_text", "metadata"] = Field(
        default="metadata",
        description="Fuente principal usada para decidir.",
    )


class ScreeningRunCounts(BaseModel):
    include: int = Field(default=0, ge=0)
    review: int = Field(default=0, ge=0)
    exclude: int = Field(default=0, ge=0)


class ScreeningRunData(BaseModel):
    collection_id: str = Field(..., description="Coleccion sobre la que se ejecuta el screening.")
    research_question: str = Field(..., min_length=1, description="Pregunta de investigacion.")
    inclusion_criteria: List[str] = Field(
        default_factory=list,
        description="Criterios de inclusion aplicados.",
    )
    exclusion_criteria: List[str] = Field(
        default_factory=list,
        description="Criterios de exclusion aplicados.",
    )
    status: Literal["queued", "processing", "completed", "failed"] = Field(
        default="queued",
        description="Estado actual de la ejecucion.",
    )
    job_id: Optional[str] = Field(None, description="Job asociado a la ejecucion.")
    total_articles: int = Field(default=0, ge=0, description="Numero total de articulos evaluables.")
    processed_articles: int = Field(default=0, ge=0, description="Numero de articulos procesados.")
    counts: ScreeningRunCounts = Field(
        default_factory=ScreeningRunCounts,
        description="Resumen de decisiones del run.",
    )
    error_message: Optional[str] = Field(None, description="Error de ejecucion si existe.")


class CollectionSynthesisRunRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Prompt del usuario para sintetizar la coleccion.")


class CollectionSynthesisPaperRequest(BaseModel):
    paper_response: str = Field(..., min_length=1, description="Version paper de la sintesis.")
    paper_title: Optional[str] = Field(None, description="Titulo opcional de la version paper.")


class CollectionSynthesisData(BaseModel):
    collection_id: str = Field(..., description="Coleccion sobre la que se ejecuta la sintesis.")
    prompt: str = Field(..., min_length=1, description="Prompt original del usuario.")
    response: str = Field(default="", description="Respuesta generada para la sintesis.")
    status: Literal["queued", "processing", "completed", "failed"] = Field(
        default="queued",
        description="Estado actual de la sintesis.",
    )
    job_id: Optional[str] = Field(None, description="Job asociado a la sintesis.")
    context_source: Optional[Literal["full_text", "metadata"]] = Field(
        default=None,
        description="Fuente principal usada en la sintesis.",
    )
    agent: Optional[str] = Field(None, description="Agente utilizado para generar la respuesta.")
    prompt_version: Optional[str] = Field(None, description="Version del prompt usada por el agente.")
    error_message: Optional[str] = Field(None, description="Error de ejecucion si existe.")
    paper_response: Optional[str] = Field(None, description="Version paper persistida de la sintesis.")
    paper_title: Optional[str] = Field(None, description="Titulo de la version paper.")
