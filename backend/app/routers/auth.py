"""
Rutas de Autenticación.

Endpoints SOLO para autenticación (register, login, logout).
Operaciones de perfil están en /user.
"""
from fastapi import APIRouter, Depends
from app.controllers import AuthController
from app.models import UserRegister, UserLogin
from app.core import StandardResponse, create_response_examples, get_current_user

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
    register_data: UserRegister,
    controller: AuthController = Depends()
):
    """
    Registrar un nuevo usuario
    
    No requiere token. Cualquiera puede registrarse.
    """
    return await controller.register(register_data)

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
# Movidas a /user - Las operaciones de perfil están en /user/me, /user/profile, /user/password

@router.post(
    "/logout",
    response_model=StandardResponse,
    summary="Cerrar sesión",
    responses=create_response_examples(
        success_example={
            "message": "Sesión cerrada exitosamente",
            "data": {
                "email": "usuario@example.com"
            }
        }
    )
)
async def logout(
    current_user: dict = Depends(get_current_user),
    controller: AuthController = Depends()
):
    """
    Cerrar sesión.
    """
    return await controller.logout(current_user)

