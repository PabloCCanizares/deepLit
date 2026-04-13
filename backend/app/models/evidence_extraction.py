from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class EvidenceExtractionRunRequest(BaseModel):
    screening_run_id: Optional[str] = Field(
        None,
        description="Run de screening opcional para acotar los articulos.",
    )
    selection_mode: Literal["all", "screening_include", "screening_include_review"] = Field(
        default="all",
        description="Modo de seleccion de articulos para la extraccion.",
    )


class EvidenceExtractionLLMResult(BaseModel):
    objective: Optional[str] = Field(None, description="Objetivo principal del articulo.")
    research_questions: List[str] = Field(
        default_factory=list,
        description="Preguntas de investigacion identificadas.",
    )
    methodology: Optional[str] = Field(None, description="Metodologia principal del articulo.")
    dataset: Optional[str] = Field(None, description="Dataset o fuente de datos principal.")
    variables: List[str] = Field(
        default_factory=list,
        description="Variables principales mencionadas.",
    )
    metrics: List[str] = Field(
        default_factory=list,
        description="Metricas o criterios de evaluacion detectados.",
    )
    findings: List[str] = Field(
        default_factory=list,
        description="Hallazgos principales del articulo.",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Limitaciones principales del estudio.",
    )
    future_work: List[str] = Field(
        default_factory=list,
        description="Lineas de trabajo futuro mencionadas.",
    )
    confidence: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Confianza estimada de 0 a 1.",
    )


class EvidenceExtractionObjectiveResult(BaseModel):
    objective: Optional[str] = Field(None, description="Objetivo principal del articulo.")
    research_questions: List[str] = Field(
        default_factory=list,
        description="Preguntas de investigacion identificadas.",
    )
    support_snippets: List[str] = Field(
        default_factory=list,
        description="Fragmentos breves de soporte para objetivo y preguntas.",
    )


class EvidenceExtractionMethodsResult(BaseModel):
    methodology: Optional[str] = Field(None, description="Metodologia principal del articulo.")
    dataset: Optional[str] = Field(None, description="Dataset o fuente de datos principal.")
    variables: List[str] = Field(
        default_factory=list,
        description="Variables principales mencionadas.",
    )
    metrics: List[str] = Field(
        default_factory=list,
        description="Metricas o criterios de evaluacion detectados.",
    )
    support_snippets: List[str] = Field(
        default_factory=list,
        description="Fragmentos breves de soporte para metodologia, dataset o metricas.",
    )


class EvidenceExtractionFindingsResult(BaseModel):
    findings: List[str] = Field(
        default_factory=list,
        description="Hallazgos principales del articulo.",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Limitaciones principales del estudio.",
    )
    future_work: List[str] = Field(
        default_factory=list,
        description="Lineas de trabajo futuro mencionadas.",
    )
    support_snippets: List[str] = Field(
        default_factory=list,
        description="Fragmentos breves de soporte para hallazgos, limitaciones o future work.",
    )
