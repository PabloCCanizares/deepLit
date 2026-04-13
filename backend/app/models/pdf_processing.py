import re
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


def _looks_like_partial_reference(text: str) -> bool:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if not normalized:
        return True

    year_match = re.search(r"\(?\b(19|20)\d{2}[a-z]?\)?", normalized)
    if not year_match:
        return False

    trailing_text = normalized[year_match.end():].strip(" .,:;-")
    if len(trailing_text) >= 8:
        return False

    return bool(
        re.fullmatch(
            r"[A-ZÁÉÍÓÚÑ][A-Za-zÀ-ÿ'.,&\-\s]+(?:et al\.)?\s*\(?\d{4}[a-z]?\)?\.?",
            normalized,
            flags=re.IGNORECASE,
        )
    )


class PdfMetadata(BaseModel):
    doi: Optional[str] = Field(None, description="DOI del documento si se encuentra.")
    title: str = Field(..., description="Titulo principal del documento.")
    year: int = Field(..., description="Ano de publicacion. Si no esta explicito, estima")
    category: str = Field(..., description="Categoria tematica del documento.")
    type: str = Field(..., description="Tipo de documento.")
    keywords: List[str] = Field(default_factory=list, description="Lista de palabras clave.")
    authors: List[str] = Field(default_factory=list, description="Lista de autores.")
    referenced_works: List[str] = Field(default_factory=list, description="Lista de referencias bibliograficas completas.")
    abstract: Optional[str] = Field(None, description="Abstract o resumen original.")

    @field_validator("referenced_works", mode="before")
    @classmethod
    def normalize_referenced_works(cls, value):
        if value is None:
            return []
        if not isinstance(value, list):
            value = [value]

        cleaned = []
        seen = set()
        for item in value:
            if item is None:
                continue
            text = re.sub(r"\s+", " ", str(item).strip())
            if not text:
                continue
            if text.isdigit() or re.fullmatch(r"\[\d+\]", text):
                continue
            if _looks_like_partial_reference(text):
                continue
            dedupe_key = text.casefold()
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            cleaned.append(text)
        return cleaned
