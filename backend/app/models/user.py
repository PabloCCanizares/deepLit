from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegister(BaseModel):
    """Schema para registrar usuario"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Mínimo 6 caracteres")
    name: Optional[str] = None

class UserLogin(BaseModel):
    """Schema para login"""
    email: EmailStr
    password: str

# FIXME no se si es el lugar correcto
class UserProfileUpdate(BaseModel):
    """Schema para actualizar perfil"""
    name: str = Field(..., min_length=1, description="Nombre no puede estar vacío")
    profileImage: Optional[str] = Field(None, description="Imagen en formato base64")

class ChangePasswordRequest(BaseModel):
    """Schema para cambiar contraseña"""
    currentPassword: str = Field(..., description="Contraseña actual")
    newPassword: str = Field(..., min_length=6, description="Nueva contraseña mínimo 6 caracteres")

