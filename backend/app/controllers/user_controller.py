"""
Controlador de Usuario.

Responsabilidad: Gestionar operaciones de perfil del usuario.
"""
from fastapi import Depends
from app.services.user_service import UserService
from app.models import UserProfileUpdate, ChangePasswordRequest
from app.core import StandardResponse


class UserController:
    """
    Controller para operaciones del perfil de usuario.
    """
    
    def __init__(self, service: UserService = Depends()):
        self.service = service
    
    async def get_me(self, current_user: dict) -> StandardResponse:
        """
        Obtener información del usuario actual.
        """
        return StandardResponse(
            success=True,
            message="Usuario obtenido exitosamente",
            data={
                "_id": str(current_user.get("_id")),
                "email": current_user.get("email"),
                "name": current_user.get("name", ""),
                "profileImage": current_user.get("profileImage", None)
            }
        )
    
    async def update_profile(
        self,
        update_data: UserProfileUpdate,
        current_user: dict
    ) -> StandardResponse:
        """
        Actualizar perfil del usuario (nombre e/o imagen).
        """
        result = await self.service.update_profile(
            email=current_user["email"],
            name=update_data.name,
            profile_image=update_data.profileImage
        )
        return StandardResponse(
            success=True,
            message="Perfil actualizado exitosamente",
            data=result
        )
    
    async def change_password(
        self,
        pwd_data: ChangePasswordRequest,
        current_user: dict
    ) -> StandardResponse:
        """
        Cambiar contraseña del usuario.
        """
        result = await self.service.change_password(
            current_user["email"],
            pwd_data.currentPassword,
            pwd_data.newPassword
        )
        return StandardResponse(
            success=True,
            message="Contraseña actualizada exitosamente",
            data=result
        )
