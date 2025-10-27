from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

# ============================================
# REQUEST MODELS (Input)
# ============================================

class Pagination(BaseModel):
    """Paginación para consultas"""
    limit: int = Field(default=10, ge=1, le=100, description="Límite de resultados (1-100)")
    offset: int = Field(default=0, ge=0, description="Desplazamiento para paginación")

class QueryBody(BaseModel):
    """Query para obtener artículos con paginación y filtros"""
    pagination: Pagination
    filters: Optional[Dict[str, Any]] = Field(None, description="Filtros opcionales (year, category, etc.)")