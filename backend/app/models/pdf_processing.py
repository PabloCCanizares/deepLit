import re
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


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
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if not text:
                continue
            if text.isdigit() or re.fullmatch(r"\[\d+\]", text):
                continue
            cleaned.append(text)
        return cleaned
