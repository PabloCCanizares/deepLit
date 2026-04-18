from pydantic import BaseModel, Field
from typing import Optional

# ============================================
# REQUEST MODELS (Input)
# ============================================

class PaperCreate(BaseModel):
    """Schema para crear un paper (subir PDF a una colección)"""
    filename: str = Field(..., description="Nombre del archivo PDF")
    content: str = Field(..., description="Contenido del PDF en base64")
    collection_id: str = Field(..., description="ID de la colección a la que pertenece el paper")
    title: Optional[str] = Field(None, max_length=500, description="Título del paper (opcional, se usa filename si no se proporciona)")
    notes: Optional[str] = Field(None, description="Notas o conocimiento adicional del usuario sobre el paper")


class PaperUpdate(BaseModel):
    """Schema para actualizar un paper"""
    title: Optional[str] = Field(None, max_length=500, description="Título del paper")
    notes: Optional[str] = Field(None, description="Notas o conocimiento adicional del usuario")
