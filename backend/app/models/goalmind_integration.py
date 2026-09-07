"""Wire models for the read-only GoalMind literature-search provider boundary."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GoalMindLiteratureSearchRequest(BaseModel):
    """Canonical GoalMind `literature.search/v1` request."""

    model_config = ConfigDict(extra="forbid", strict=True)

    query: str = Field(min_length=1, max_length=2048)
    limit: int = Field(default_factory=lambda: 10, ge=1, le=100)
    offset: int = Field(default_factory=lambda: 0, ge=0)
    # A missing optional scalar needs a runtime sentinel while explicit JSON null must still
    # be rejected because the canonical TAC schema permits omission, not null.
    year_from: int = Field(default_factory=lambda: None, ge=1000)  # type: ignore[arg-type]
    year_to: int = Field(default_factory=lambda: None, ge=1000)  # type: ignore[arg-type]

    @model_validator(mode="after")
    def validate_year_range(self) -> "GoalMindLiteratureSearchRequest":
        if (
            self.year_from is not None
            and self.year_to is not None
            and self.year_from > self.year_to
        ):
            raise ValueError("year_from cannot exceed year_to")
        return self


class GoalMindLiteratureWork(BaseModel):
    """Bounded normalized work returned to GoalMind."""

    model_config = ConfigDict(extra="forbid", strict=True)

    source_ref: str = Field(min_length=1, max_length=512)
    title: str = Field(max_length=1000)
    year: int | None
    category: str | None = None


class GoalMindLiteratureSearchResponse(BaseModel):
    """Canonical GoalMind `literature.search/v1` response."""

    model_config = ConfigDict(extra="forbid", strict=True)

    works: list[GoalMindLiteratureWork] = Field(max_length=100)
    total: int = Field(ge=0)


__all__ = [
    "GoalMindLiteratureSearchRequest",
    "GoalMindLiteratureSearchResponse",
    "GoalMindLiteratureWork",
]
