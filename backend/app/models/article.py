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
    collection_id: Optional[str] = Field(None, description="ID de la colección para filtrar artículos (opcional)")
    sort_by: Optional[str] = Field(None, description="Criterio de ordenamiento (campo-orden) (e.g., 'year-desc')")

class ArticleUpdate(BaseModel):
    """
    Schema para actualizar un artículo.
    """
    # Campos principales
    title: Optional[str] = Field(None, max_length=500, description="Título del artículo")
    abstract: Optional[str] = Field(None, description="Abstract del artículo")
    authors: Optional[Any] = Field(None, description="Autores del artículo")
    year: Optional[Any] = Field(None, description="Año de publicación")
    
    # Campos de clasificación
    category: Optional[str] = Field(None, description="Categoría del artículo")
    type: Optional[str] = Field(None, description="Tipo de publicación")
    keywords: Optional[Any] = Field(None, description="Palabras clave (lista o string)")
    pages: Optional[Any] = Field(None, description="Número de páginas")
    citations: Optional[Any] = Field(None, description="Número de citas")
    doi: Optional[str] = Field(None, description="DOI")
    relevance_score: Optional[Any] = Field(None, description="Score de relevancia")
    pdf_url: Optional[str] = Field(None, description="URL del PDF")
    landing_page_url: Optional[str] = Field(None, description="URL de la página del artículo")
    summary: Optional[str] = Field(None, description="Resumen del usuario")
    observations: Optional[str] = Field(None, description="Notas u observaciones del usuario")
    referenced_works: Optional[Any] = Field(None, description="Referencias bibliográficas")
    related_works: Optional[Any] = Field(None, description="Obras relacionadas")
    counts_by_year: Optional[Any] = Field(None, description="Citas por año")
