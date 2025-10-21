from pydantic import BaseModel, EmailStr, Field
from typing import Optional

# ============================================
# AUTH REQUEST MODELS (Input)
# ============================================

class UserRegister(BaseModel):
    """Schema para registrar nuevo usuario"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Mínimo 6 caracteres")
    name: Optional[str] = None

class UserLogin(BaseModel):
    """Schema para iniciar sesión"""
    email: EmailStr
    password: str

