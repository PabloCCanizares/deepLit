"""
Controlador de Usuario.

Responsabilidad: Gestionar operaciones de perfil del usuario.
"""
from fastapi import Depends
from fastapi.responses import FileResponse
from app.services.user_service import UserService
from app.services.storage_service import StorageService
from app.models import UserProfileUpdate, ChangePasswordRequest
from app.core import StandardResponse, NotFoundError


class UserController:
    """
    Controller para operaciones del perfil de usuario.
    """
    
    def __init__(self, service: UserService = Depends()):
        self.service = service
        self.storage = StorageService()
    
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
                "profile_image": current_user.get("profile_image", None),
                "position": current_user.get("position", ""),
                "specialization": current_user.get("specialization", ""),
                "workgroup": current_user.get("workgroup", ""),
                "degree": current_user.get("degree", ""),
                "university": current_user.get("university", ""),
                "experience": current_user.get("experience", "")
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
            profile_image=update_data.profile_image,
            position=update_data.position,
            specialization=update_data.specialization,
            workgroup=update_data.workgroup,
            degree=update_data.degree,
            university=update_data.university,
            experience=update_data.experience
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
    
    async def get_profile_image(self, current_user: dict) -> FileResponse:
        """
        Obtener la imagen de perfil del usuario autenticado.
        
        Nota: Devuelve FileResponse (no StandardResponse) porque
        se envía un archivo binario, no JSON.
        """
        profile_image = current_user.get("profile_image")
        
        if not profile_image:
            raise NotFoundError("El usuario no tiene imagen de perfil")
        
        # Verificar que el archivo existe
        if not self.storage.exists(profile_image, storage_location="profiles"):
            raise NotFoundError("Archivo de imagen no encontrado en el servidor")
        
        # Obtener la ruta completa y devolver el archivo
        file_path = self.storage.get_path(profile_image, storage_location="profiles")
        
        # FileResponse con cache (consistente con imágenes de colección)
        return FileResponse(
            path=file_path,
            headers={"Cache-Control": "public, max-age=3600"}
        )
