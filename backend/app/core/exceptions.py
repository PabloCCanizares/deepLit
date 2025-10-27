"""
Excepciones personalizadas y handlers centralizados.
"""
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.core.responses import StandardResponse


# ============================================
# EXCEPCIONES PERSONALIZADAS
# ============================================

class AppException(Exception):
    """
    Excepción base de la aplicación.
    Todas las excepciones personalizadas deben heredar de esta.
    """
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "INTERNAL_ERROR"
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(self.message)


class AuthenticationError(AppException):
    """Error de autenticación (401)"""
    def __init__(self, message: str = "No autorizado"):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTHENTICATION_ERROR"
        )


class AuthorizationError(AppException):
    """Error de autorización/permisos (403)"""
    def __init__(self, message: str = "Sin permisos para realizar esta acción"):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="AUTHORIZATION_ERROR"
        )


class NotFoundError(AppException):
    """Recurso no encontrado (404)"""
    def __init__(self, message: str = "Recurso no encontrado"):
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND_ERROR"
        )


class ValidationError(AppException):
    """Error de validación de datos (400)"""
    def __init__(self, message: str = "Datos inválidos"):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VALIDATION_ERROR"
        )


class ConflictError(AppException):
    """Conflicto con el estado actual (409)"""
    def __init__(self, message: str = "Conflicto con el estado actual"):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT_ERROR"
        )


# ============================================
# EXCEPTION HANDLERS
# ============================================

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """
    Handler para excepciones personalizadas de la aplicación.
    Convierte AppException y sus subclases a StandardResponse.
    """
    # Log básico para desarrollo/producción
    print(f"⚠️  {exc.error_code} en {request.method} {request.url.path}: {exc.message}")
    
    response = StandardResponse(
        success=False,
        message=exc.message,
        data=None,
        error=exc.message,
        error_code=exc.error_code
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=response.model_dump()
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handler para HTTPException de FastAPI.
    Convierte errores HTTP estándar a StandardResponse.
    """
    # Log básico para desarrollo/producción
    print(f"⚠️  HTTP_{exc.status_code} en {request.method} {request.url.path}: {exc.detail}")
    
    response = StandardResponse(
        success=False,
        message=exc.detail,
        data=None,
        error=exc.detail,
        error_code=f"HTTP_{exc.status_code}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=response.model_dump()
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handler para errores de validación de Pydantic.
    Formatea errores de validación (422) a StandardResponse.
    """
    # Extraer primer error para el mensaje principal
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    
    # Construir mensaje legible
    field = first_error.get("loc", ["campo"])[-1]  # Último elemento de loc
    msg = first_error.get("msg", "error de validación")
    
    # Log básico para desarrollo/producción
    print(f"⚠️  VALIDATION_ERROR en {request.method} {request.url.path}: {field}: {msg}")
    
    response = StandardResponse(
        success=False,
        message=f"{field}: {msg}",
        data=None,
        error=f"{field}: {msg}",
        error_code="VALIDATION_ERROR"
    )
    
    # Convertir a dict y añadir detalles de validación
    content = response.model_dump()
    content["details"] = errors  # Incluir detalles completos para debugging
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=content
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handler para excepciones no capturadas.
    Formatea errores internos (500) a StandardResponse.
    """
    import traceback
    
    # Log básico para desarrollo/producción (emoji 🔥 porque es el más grave)
    print(f"🔥 INTERNAL_SERVER_ERROR en {request.method} {request.url.path}: {type(exc).__name__}: {str(exc)}")
    
    error_message = str(exc) if request.app.debug else "Error interno del servidor"
    
    response = StandardResponse(
        success=False,
        message="Error interno del servidor",
        data=None,
        error=error_message,
        error_code="INTERNAL_SERVER_ERROR"
    )
    
    # Convertir a dict y añadir traceback si está en debug
    content = response.model_dump()
    if request.app.debug:
        content["details"] = traceback.format_exc()
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content
    )


# ============================================
# FUNCIÓN PARA REGISTRAR HANDLERS
# ============================================

def register_exception_handlers(app):
    """
    Registra todos los exception handlers en la aplicación FastAPI.
    """
    # Orden importa: de más específico a más general
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)

