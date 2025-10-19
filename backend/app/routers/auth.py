"""
Rutas de autenticación
"""
from fastapi import APIRouter, Depends
from app.controllers import AuthController
from app.models import UserRegister, UserLogin, UserProfileUpdate, ChangePasswordRequest
from app.core import StandardResponse, create_response_examples
from app.core import get_current_user

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

@router.put(
    "/profile",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "Perfil actualizado exitosamente",
            "data": {
                "email": "usuario@example.com",
                "name": "Nuevo Nombre",
                "profileImage": "data:image/png;base64,iVBORw0KGgo..."
            }
        },
        error_example={
            "message": "Error al actualizar perfil",
            "error": "Usuario no encontrado",
            "error_code": "USER_NOT_FOUND"
        }
    )
)
async def update_profile(
    update_data: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    controller: AuthController = Depends()
):
    """
    Actualizar perfil del usuario (nombre e imagen)
    
    Requiere token en header: Authorization: Bearer <token>
    
    Parámetros:
    - name: Nuevo nombre del usuario
    - profileImage: Imagen en formato base64 (opcional)
    """
    return await controller.update_profile(update_data, current_user)

@router.post(
    "/change-password",
    response_model=StandardResponse,
    responses=create_response_examples(
        success_example={
            "message": "Contraseña actualizada exitosamente",
            "data": None
        },
        error_example={
            "message": "Error al cambiar contraseña",
            "error": "La contraseña actual es incorrecta",
            "error_code": "INVALID_PASSWORD"
        }
    )
)
async def change_password(
    pwd_data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    controller: AuthController = Depends()
):
    """
    Cambiar contraseña del usuario
    
    Requiere token en header: Authorization: Bearer <token>
    
    Parámetros:
    - currentPassword: Contraseña actual (para verificación)
    - newPassword: Nueva contraseña (mínimo 6 caracteres)
    """
    return await controller.change_password(pwd_data, current_user)

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

