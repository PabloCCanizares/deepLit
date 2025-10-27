from pydantic import BaseModel, Field
from typing import Optional

# ============================================
# USER PROFILE REQUEST MODELS (Input)
# ============================================

class UserProfileUpdate(BaseModel):
    """
    Schema para actualizar perfil.
    
    Todos los campos son opcionales para permitir actualizaciones parciales.
    Por ejemplo: solo actualizar nombre, solo imagen, o ambos.
    """
    name: Optional[str] = Field(None, min_length=1, description="Nombre del usuario")
    profile_image: Optional[str] = Field(None, description="Imagen en formato base64")

class ChangePasswordRequest(BaseModel):
    """Schema para cambiar contraseña del usuario"""
    currentPassword: str = Field(..., description="Contraseña actual")
    newPassword: str = Field(..., min_length=6, description="Nueva contraseña mínimo 6 caracteres")

