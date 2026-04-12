from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ScreeningRunRequest(BaseModel):
    research_question: str = Field(
        ...,
        min_length=1,
        description="Pregunta de investigacion que guia el cribado.",
    )
    inclusion_criteria: List[str] = Field(
        default_factory=list,
        description="Criterios de inclusion opcionales.",
    )
    exclusion_criteria: List[str] = Field(
        default_factory=list,
        description="Criterios de exclusion opcionales.",
    )


class ScreeningDecisionLLMResult(BaseModel):
    decision: Literal["include", "review", "exclude"] = Field(
        ...,
        description="Decision de cribado para el articulo.",
    )
    reason: str = Field(
        ...,
        min_length=1,
        description="Justificacion breve basada en el contexto disponible.",
    )
    confidence: Optional[float] = Field(
        None,
        ge=0,
        le=1,
        description="Confianza estimada de 0 a 1.",
    )


class ScreeningDecisionUpdateRequest(BaseModel):
    decision: Literal["include", "review", "exclude"] = Field(
        ...,
        description="Nueva decision manual para el articulo.",
    )
    reason: Optional[str] = Field(
        None,
        min_length=1,
        description="Justificacion opcional de la actualizacion manual.",
    )
