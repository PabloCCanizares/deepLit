"""
Modelos de datos de la aplicación.

Contiene los schemas de Pydantic para validación.
"""

from app.models.user import UserRegister, UserLogin, UserProfileUpdate, ChangePasswordRequest
from app.models.pdf import PdfUpload
from app.models.article import Pagination, ArticlesQuery
__all__ = [
    "UserRegister",
    "UserLogin",
    "UserProfileUpdate",
    "ChangePasswordRequest",
    "PdfUpload",
    "Pagination",
    "ArticlesQuery"
]

