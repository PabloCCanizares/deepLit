"""
Rutas de Usuario (Perfil).

Endpoints para gestionar el perfil del usuario autenticado.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from app.controllers import UserController
from app.models import UserProfileUpdate, ChangePasswordRequest
from app.core import StandardResponse, create_response_examples, get_current_user

router = APIRouter(prefix="/user", tags=["User Profile"])

# ============================================
# RUTAS PROTEGIDAS (requieren autenticación)
# ============================================

@router.get(
    "/me",
    response_model=StandardResponse,
    summary="Obtener mi perfil",
    responses=create_response_examples(
        success_example={
            "message": "Usuario obtenido exitosamente",
            "data": {
                "_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "usuario@example.com",
                "name": "Juan Pérez",
                "profile_image": "usuario_at_example_com_20241027.jpg"
            }
        },
        error_example={
            "message": "Error al obtener información del usuario",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_me(
    current_user: dict = Depends(get_current_user),
    controller: UserController = Depends()
):
    """
    Obtener información del usuario autenticado actual.
    """
    return await controller.get_me(current_user)


@router.put(
    "/me/profile",
    response_model=StandardResponse,
    summary="Actualizar mi perfil",
    responses=create_response_examples(
        success_example={
            "message": "Perfil actualizado exitosamente",
            "data": {
                "email": "usuario@example.com",
                "name": "Nuevo Nombre",
                "profile_image": "usuario_at_example_com_20241027.jpg"
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
    controller: UserController = Depends()
):
    """
    Actualizar perfil del usuario autenticado (nombre e imagen).
    """
    return await controller.update_profile(update_data, current_user)


@router.put(
    "/me/password",
    response_model=StandardResponse,
    summary="Cambiar mi contraseña",
    responses=create_response_examples(
        success_example={
            "message": "Contraseña actualizada exitosamente",
            "data": {
                "message": "Contraseña actualizada correctamente"
            }
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
    controller: UserController = Depends()
):
    """
    Cambiar contraseña del usuario autenticado.
    """
    return await controller.change_password(pwd_data, current_user)

@router.get(
    "/me/profile-image",
    response_class=FileResponse,
    summary="Obtener mi imagen de perfil",
    description="Devuelve la imagen de perfil del usuario autenticado. Requiere token de autenticación."
)
async def get_my_profile_image(
    current_user: dict = Depends(get_current_user),
    controller: UserController = Depends()
):
    """
    Obtener la imagen de perfil del usuario autenticado.
    """
    return await controller.get_profile_image(current_user)
