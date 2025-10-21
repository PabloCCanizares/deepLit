from pydantic import BaseModel, Field

# ============================================
# REQUEST MODELS (Input)
# ============================================

class PdfUpload(BaseModel):
    """Schema para subir pdf"""
    filename: str = Field(..., description="Nombre del archivo PDF")
    content: str = Field(..., description="Contenido del PDF en base64")
