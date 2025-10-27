"""
Módulo core de la aplicación.

Contiene:
- Autenticación (auth.py)
- Respuestas estandarizadas (responses.py)
- Excepciones personalizadas (exceptions.py)
"""

# Respuestas estandarizadas
from app.core.responses import StandardResponse, create_response_examples

# Excepciones personalizadas
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
    ConflictError,
    register_exception_handlers
)

# Funciones de autenticación
from app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)

__all__ = [
    # Responses
    "StandardResponse",
    "create_response_examples",
    
    # Exceptions
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "ValidationError",
    "ConflictError",
    "register_exception_handlers",
    
    # Auth
    "hash_password",
    "verify_password",
    "create_access_token",
    "get_current_user",
]
