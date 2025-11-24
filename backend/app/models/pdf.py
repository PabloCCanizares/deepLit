from pydantic import BaseModel, Field
from typing import Optional

# ============================================
# REQUEST MODELS (Input)
# ============================================

class PdfUpload(BaseModel):
    """Schema para subir pdf"""
    filename: str = Field(..., description="Nombre del archivo PDF")
    content: str = Field(..., description="Contenido del PDF en base64")
    collection_id: Optional[str] = Field(None, description="ID de la colección para filtrar artículos (opcional)")
