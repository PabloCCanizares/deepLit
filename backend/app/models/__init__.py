"""
Modelos de datos de la aplicación.

Contiene los schemas de Pydantic para validación.
"""

from app.models.user import UserRegister, UserLogin
from app.models.pdf import PdfUpload

__all__ = [
    "UserRegister",
    "UserLogin",
    "PdfUpload",
]

