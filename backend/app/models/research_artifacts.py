from typing import List, Literal, Optional

from pydantic import BaseModel, Field
from app.models.clustering import ClusterSummary


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
    prompt_version: Optional[str] = Field(None, description="Version del prompt usada por el workflow.")
    error_message: Optional[str] = Field(None, description="Error de ejecucion si existe.")
    paper_response: Optional[str] = Field(None, description="Version paper persistida de la sintesis.")
    paper_title: Optional[str] = Field(None, description="Titulo de la version paper.")


class EvidenceExtractionRunData(BaseModel):
    collection_id: str = Field(..., description="Coleccion sobre la que se ejecuta la extraccion.")
    screening_run_id: Optional[str] = Field(
        None,
        description="Screening run opcional usado para acotar articulos.",
    )
    selection_mode: Literal["all", "screening_include", "screening_include_review"] = Field(
        default="all",
        description="Modo de seleccion de articulos del run.",
    )
    status: Literal["queued", "processing", "completed", "failed"] = Field(
        default="queued",
        description="Estado actual de la extraccion.",
    )
    job_id: Optional[str] = Field(None, description="Job asociado a la extraccion.")
    total_articles: int = Field(default=0, ge=0, description="Numero total de articulos evaluables.")
    processed_articles: int = Field(default=0, ge=0, description="Numero de articulos procesados.")
    prompt_version: Optional[str] = Field(None, description="Version del prompt usada por el workflow.")
    schema_version: Optional[str] = Field(None, description="Version del schema usado por el workflow.")
    error_message: Optional[str] = Field(None, description="Error de ejecucion si existe.")


class SupportSnippetReference(BaseModel):
    text: str = Field(..., min_length=1, description="Fragmento breve de soporte.")
    facet: Literal["objective", "methods", "findings"] = Field(
        ...,
        description="Bloque de extracción al que da soporte.",
    )
    page: Optional[int] = Field(None, description="Página origen si se conoce.")
    start_index: Optional[int] = Field(
        None,
        description="Offset aproximado del chunk de origen si se conoce.",
    )


class ArticleExtractionData(BaseModel):
    run_id: str = Field(..., description="ID del run de extraccion.")
    article_id: str = Field(..., description="ID del articulo analizado.")
    article_title: Optional[str] = Field(None, description="Titulo del articulo analizado.")
    source_type: Literal["full_text", "metadata"] = Field(
        default="metadata",
        description="Fuente principal usada para la extraccion.",
    )
    objective: Optional[str] = Field(None, description="Objetivo principal del articulo.")
    objective_support: List[SupportSnippetReference] = Field(
        default_factory=list,
        description="Referencias estructuradas de soporte para objetivo y preguntas.",
    )
    research_questions: List[str] = Field(
        default_factory=list,
        description="Preguntas de investigacion detectadas.",
    )
    methodology: Optional[str] = Field(None, description="Metodologia principal.")
    methods_support: List[SupportSnippetReference] = Field(
        default_factory=list,
        description="Referencias estructuradas de soporte metodológico.",
    )
    dataset: Optional[str] = Field(None, description="Dataset o fuente de datos principal.")
    variables: List[str] = Field(
        default_factory=list,
        description="Variables mencionadas.",
    )
    metrics: List[str] = Field(
        default_factory=list,
        description="Metricas detectadas.",
    )
    findings: List[str] = Field(
        default_factory=list,
        description="Hallazgos principales extraidos.",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Limitaciones identificadas.",
    )
    future_work: List[str] = Field(
        default_factory=list,
        description="Lineas de trabajo futuro identificadas.",
    )
    findings_support: List[SupportSnippetReference] = Field(
        default_factory=list,
        description="Referencias estructuradas de soporte para hallazgos.",
    )
    confidence: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Confianza estimada en el rango 0-1.",
    )


class ClusteringRunData(BaseModel):
    collection_id: str = Field(..., description="Coleccion sobre la que se ejecuta el clustering.")
    evidence_extraction_run_id: str = Field(
        ...,
        description="Run de evidence extraction usado como base.",
    )
    requested_cluster_count: Optional[int] = Field(
        None,
        ge=2,
        le=8,
        description="Numero de clusters solicitado por el usuario.",
    )
    selected_cluster_count: int = Field(
        default=0,
        ge=0,
        description="Numero final de clusters generado por el sistema.",
    )
    status: Literal["queued", "processing", "completed", "failed"] = Field(
        default="queued",
        description="Estado actual del clustering.",
    )
    job_id: Optional[str] = Field(None, description="Job asociado al clustering.")
    total_articles: int = Field(default=0, ge=0, description="Numero total de articulos evaluados.")
    processed_articles: int = Field(default=0, ge=0, description="Numero de articulos agrupados.")
    algorithm_version: Optional[str] = Field(
        None,
        description="Version del pipeline de clustering.",
    )
    silhouette_score: Optional[float] = Field(
        None,
        ge=-1,
        le=1,
        description="Metrica silhouette agregada del clustering cuando aplique.",
    )
    clusters: List[ClusterSummary] = Field(
        default_factory=list,
        description="Resumen de clusters generados en el run.",
    )
    error_message: Optional[str] = Field(None, description="Error de ejecucion si existe.")


class ClusterAssignmentData(BaseModel):
    run_id: str = Field(..., description="ID del run de clustering.")
    cluster_id: str = Field(..., description="ID interno del cluster.")
    cluster_label: str = Field(..., min_length=1, description="Etiqueta legible del cluster.")
    article_id: str = Field(..., description="ID del articulo asignado.")
    article_title: Optional[str] = Field(None, description="Titulo del articulo asignado.")
    source_type: Literal["full_text", "metadata"] = Field(
        default="metadata",
        description="Fuente principal usada en la evidencia base.",
    )
    objective: Optional[str] = Field(None, description="Objetivo del articulo.")
    methodology: Optional[str] = Field(None, description="Metodologia del articulo.")
    dataset: Optional[str] = Field(None, description="Dataset del articulo.")
    variables: List[str] = Field(default_factory=list, description="Variables del articulo.")
    metrics: List[str] = Field(default_factory=list, description="Metricas del articulo.")
    similarity_score: Optional[float] = Field(
        None,
        ge=-1,
        le=1,
        description="Similitud coseno respecto al centroide del cluster.",
    )
