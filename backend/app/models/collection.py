from pydantic import BaseModel, Field
from typing import Optional

# ============================================
# REQUEST MODELS (Input)
# ============================================

class CollectionCreate(BaseModel):
    """Schema para crear una colección"""
    name: str = Field(..., min_length=1, max_length=100, description="Nombre de la colección")
    description: Optional[str] = Field(None, max_length=500, description="Descripción opcional")
    color: Optional[str] = Field("#3B82F6", description="Color en formato hex para UI")
    image: Optional[str] = Field(None, description="Imagen en formato base64")

class CollectionUpdate(BaseModel):
    """Schema para actualizar una colección"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Nombre de la colección")
    description: Optional[str] = Field(None, max_length=500, description="Descripción opcional")
    color: Optional[str] = Field(None, description="Color en formato hex para UI")
    image: Optional[str] = Field(None, description="Imagen en formato base64")

class AddArticleToCollection(BaseModel):
    """Schema para añadir un artículo a una colección"""
    article_id: str = Field(..., description="ID del artículo a añadir")

