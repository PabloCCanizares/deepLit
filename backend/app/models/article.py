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
    abstract: Optional[str] = Field(None, description="Resumen del artículo")
    authors: Optional[str] = Field(None, description="Autores del artículo")
    year: Optional[str] = Field(None, description="Año de publicación")
    
    # Campos de clasificación
    category: Optional[str] = Field(None, description="Categoría del artículo")
    type: Optional[str] = Field(None, description="Tipo de publicación")
    keywords: Optional[str] = Field(None, description="Palabras clave")
    
    # Campos de metadata
    acronym: Optional[str] = Field(None, description="Acrónimo de la conferencia/journal")
    citations: Optional[str] = Field(None, description="Número de citas")
    pages: Optional[str] = Field(None, description="Número de páginas")
    
    # Campos adicionales
    link: Optional[str] = Field(None, description="Enlace al artículo")
    citation: Optional[str] = Field(None, description="Formato de citación")
    summary: Optional[str] = Field(None, description="Resumen adicional")
    observations: Optional[str] = Field(None, description="Observaciones del usuario")