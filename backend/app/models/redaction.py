from typing import List, Literal, Optional

from pydantic import BaseModel, Field


RedactionTextType = Literal[
    "summary",
    "introduction",
    "state_of_the_art",
    "conclusions",
    "full_draft",
]


class RedactionRunRequest(BaseModel):
    user_idea: str = Field(
        ...,
        min_length=20,
        description="Aportacion intelectual del usuario que actua como eje del borrador.",
    )
    text_type: RedactionTextType = Field(
        ...,
        description="Tipo de texto academico solicitado.",
    )
    synthesis_run_id: Optional[str] = Field(
        None,
        description="Sintesis de coleccion previa que se usa como insumo.",
    )
    evidence_extraction_run_id: Optional[str] = Field(
        None,
        description="Run de evidence extraction previo que se usa como insumo.",
    )


class SectionMarker(BaseModel):
    heading: str = Field(..., min_length=1, description="Titulo de la seccion dentro del borrador.")
    level: int = Field(..., ge=1, le=3, description="Nivel jerarquico de la seccion (1 a 3).")


class ArticleReference(BaseModel):
    article_id: str = Field(..., description="Identificador interno del articulo citado.")
    article_title: str = Field(..., description="Titulo del articulo citado.")
    cited_as: str = Field(
        ...,
        description="Forma exacta en que la cita aparece en el texto del borrador.",
    )


class RedactionResult(BaseModel):
    title: str = Field(..., description="Titulo del borrador generado.")
    draft_text: str = Field(..., description="Texto completo del borrador.")
    sections: List[SectionMarker] = Field(
        default_factory=list,
        description="Secciones identificadas en el borrador con su nivel.",
    )
    references: List[ArticleReference] = Field(
        default_factory=list,
        description="Referencias citadas en el borrador.",
    )
    review_points: List[str] = Field(
        default_factory=list,
        description=(
            "Puntos del borrador que el usuario debe revisar manualmente "
            "(afirmaciones potencialmente debiles, secciones con poco apoyo "
            "documental o decisiones de redaccion a validar)."
        ),
    )


class RedactionLLMResult(BaseModel):
    title: str = Field(..., description="Titulo del borrador generado.")
    draft_text: str = Field(..., description="Texto completo del borrador.")
    sections: List[SectionMarker] = Field(
        default_factory=list,
        description="Secciones identificadas en el borrador con su nivel.",
    )
    references: List[ArticleReference] = Field(
        default_factory=list,
        description="Referencias citadas en el borrador.",
    )
    review_points: List[str] = Field(
        default_factory=list,
        description=(
            "Puntos del borrador que el usuario debe revisar manualmente "
            "(afirmaciones potencialmente debiles, secciones con poco apoyo "
            "documental o decisiones de redaccion a validar)."
        ),
    )
