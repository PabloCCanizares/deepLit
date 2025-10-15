from pydantic import BaseModel, Field
from typing import Optional

class PdfUpload(BaseModel):
    """Schema para subir pdf"""
    file_name: str
    content: bytes
