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

