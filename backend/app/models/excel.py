from pydantic import BaseModel, Field

# ============================================
# REQUEST MODELS (Input)
# ============================================

class ExcelUpload(BaseModel):
    """Schema para subir excel"""
    filename: str = Field(..., description="Nombre del archivo Excel")
    content: str = Field(..., description="Contenido del Excel en base64")
