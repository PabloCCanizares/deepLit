"""
Rutas de autenticación
"""
from fastapi import APIRouter, Depends
from app.controllers.auth_controller import AuthController
from app.models.user import UserRegister, UserLogin
from app.core import StandardResponse, create_response_examples
from app.core.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# ============================================
# RUTAS PÚBLICAS (sin token)
# ============================================

@router.post(
    "/register",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "Usuario registrado exitosamente",
            "data": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "usuario@example.com"
            }
        },
        error_example={
            "message": "Error al registrar usuario",
            "error": "El email ya está registrado",
            "error_code": "EMAIL_ALREADY_EXISTS"
        }
    )
)
async def register(
    user_data: UserRegister,
    controller: AuthController = Depends()
):
    """
    Registrar un nuevo usuario
    
    No requiere token. Cualquiera puede registrarse.
    """
    return await controller.register(user_data)

@router.post(
    "/login",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "Inicio de sesión exitoso",
            "data": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "user": {
                    "id": "123e4567-e89b-12d3-a456-426614174000",
                    "email": "usuario@example.com"
                }
            }
        },
        error_example={
            "message": "Error al iniciar sesión",
            "error": "Credenciales inválidas",
            "error_code": "INVALID_CREDENTIALS"
        }
    )
)
async def login(
    login_data: UserLogin,
    controller: AuthController = Depends()
):
    """
    Iniciar sesión y obtener token
    
    No requiere token. Devuelve un token que se usa en las demás rutas.
    """
    return await controller.login(login_data)

# ============================================
# RUTAS PROTEGIDAS (requieren token)
# ============================================

@router.get(
    "/me",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "Información del usuario obtenida exitosamente",
            "data": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "usuario@example.com",
                "created_at": "2025-10-12T10:30:00Z"
            }
        },
        error_example={
            "message": "Error al obtener información del usuario",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
    controller: AuthController = Depends()
):
    """
    Obtener información del usuario autenticado actual
    
    Requiere token en header: Authorization: Bearer <token>
    
    Sirve para:
    - Obtener datos del usuario logueado (email, nombre)
    - Verificar que el token sigue siendo válido
    - Mostrar perfil del usuario en el frontend
    """
    return await controller.get_user_info(current_user)

@router.post(
    "/logout",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "Sesión cerrada exitosamente",
            "data": None
        }
    )
)
async def logout(
    current_user: dict = Depends(get_current_user),
    controller: AuthController = Depends()
):
    """
    Cerrar sesión
    
    Requiere token. En JWT, el logout se hace en el cliente eliminando el token.
    Este endpoint solo confirma que el token es válido antes de que el cliente lo elimine.
    """
    return await controller.logout(current_user)
