"""
Modelos de datos de la aplicación.

Contiene los schemas de Pydantic para validación de INPUT (Request).

Organización por funcionalidad:
- auth.py: Autenticación (register, login)
- user.py: Perfil de usuario (update profile, change password)
- pdf.py: PDFs
- article.py: Artículos
"""

# Auth models (autenticación)
from app.models.auth import (
    UserRegister,
    UserLogin
)

# User models (perfil)
from app.models.user import (
    UserProfileUpdate,
    ChangePasswordRequest
)

# PDF models
from app.models.pdf import (
    PdfUpload
)

# Article models
from app.models.article import (
    Pagination,
    ArticlesQuery
)

__all__ = [
    # Auth (autenticación)
    "UserRegister",
    "UserLogin",
    
    # User (perfil)
    "UserProfileUpdate",
    "ChangePasswordRequest",
    
    # PDF
    "PdfUpload",
    
    # Article
    "Pagination",
    "ArticlesQuery",
]

