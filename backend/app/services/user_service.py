"""
Servicio de Usuario.

Responsabilidad: SOLO operaciones del perfil de usuario.
"""
from app.core.auth import hash_password, verify_password
from app.core import AuthenticationError
from app.repositories.user_repository import UserRepository


class UserService:
    
    def __init__(self):
        self.user_repo = UserRepository()
    
    async def update_profile(
        self,
        email: str,
        name: str = None,
        profile_image: str = None
    ) -> dict:
        """
        Actualizar nombre e/o imagen de perfil del usuario.
        """
        update_data = {}
        
        if name is not None:
            update_data["name"] = name
        
        if profile_image is not None:
            update_data["profileImage"] = profile_image
        
        # Si no se envió nada, no hacer nada
        if not update_data:
            # Obtener usuario actual sin modificar
            user = await self.user_repo.find_by_email(email)
            return {
                "email": user.get("email"),
                "name": user.get("name"),
                "profileImage": user.get("profileImage")
            }
        
        # Actualizar solo los campos enviados
        updated_user = await self.user_repo.update_by_email(email, update_data)
        
        return {
            "email": updated_user.get("email"),
            "name": updated_user.get("name"),
            "profileImage": updated_user.get("profileImage")
        }
    
    async def change_password(
        self,
        email: str,
        current_password: str,
        new_password: str
    ) -> dict:
        """
        Cambiar contraseña del usuario.
        """
        # Obtener usuario
        user = await self.user_repo.find_by_email(email)
        
        if not user:
            raise AuthenticationError("Usuario no encontrado")
        
        # Verificar contraseña actual
        if not verify_password(current_password, user.get("password_hash")):
            raise AuthenticationError("La contraseña actual es incorrecta")
        
        # Hashear nueva contraseña
        hashed_new_password = hash_password(new_password)
        
        # Actualizar en BD
        await self.user_repo.update_by_email(email, {"password_hash": hashed_new_password})
        
        return {"message": "Contraseña actualizada correctamente"}
