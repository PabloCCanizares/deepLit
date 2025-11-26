from pydantic import BaseModel, Field
from typing import Optional

# ============================================
# REQUEST MODELS (Input)
# ============================================

class ExcelUpload(BaseModel):
    """Schema para subir excel"""
    filename: str = Field(..., description="Nombre del archivo Excel")
    content: str = Field(..., description="Contenido del Excel en base64")
    collection_id: Optional[str] = Field(None, description="ID de la colección a la que añadir los artículos")
