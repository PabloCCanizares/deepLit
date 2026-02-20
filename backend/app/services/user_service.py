"""
Servicio de Usuario.

Responsabilidad: SOLO operaciones del perfil de usuario.
"""
import base64
import re
from datetime import datetime
from pathlib import Path
from app.core.auth import hash_password, verify_password
from app.core import AuthenticationError
from app.repositories.user_repository import UserRepository
from app.services.storage_service import StorageService


class UserService:
    
    def __init__(self):
        self.user_repo = UserRepository()
        self.storage = StorageService()
    
    async def update_profile(
        self,
        email: str,
        name: str = None,
        profile_image: str = None,
        position: str = None,
        specialization: str = None,
        workgroup: str = None,
        degree: str = None,
        university: str = None,
        experience: str = None
    ) -> dict:
        """
        Actualizar campos del perfil del usuario.
        """
        # Obtener usuario una sola vez al inicio
        user = await self.user_repo.find_by_email(email)
        
        update_data = {}
        
        if name is not None:
            update_data["name"] = name

        if position is not None:
            update_data["position"] = position

        if specialization is not None:
            update_data["specialization"] = specialization

        if workgroup is not None:
            update_data["workgroup"] = workgroup

        if degree is not None:
            update_data["degree"] = degree

        if university is not None:
            update_data["university"] = university

        if experience is not None:
            update_data["experience"] = experience
        
        if profile_image is not None:
            # Eliminar imagen antigua si existe
            old_image = user.get("profile_image")
            if old_image:
                self.storage.delete_file(old_image, storage_location="profiles")
            
            # Procesar imagen: guardar archivo y almacenar solo el nombre
            filename = await self._save_profile_image(email, profile_image)
            update_data["profile_image"] = filename
        
        # Si no se envió nada, devolver usuario actual sin modificar
        if not update_data:
            return {
                "email": user.get("email"),
                "name": user.get("name"),
                "profile_image": user.get("profile_image"),
                "position": user.get("position", ""),
                "specialization": user.get("specialization", ""),
                "workgroup": user.get("workgroup", ""),
                "degree": user.get("degree", ""),
                "university": user.get("university", ""),
                "experience": user.get("experience", "")
            }
        
        # Actualizar solo los campos enviados
        updated_user = await self.user_repo.update_by_email(email, update_data)
        
        return {
            "email": updated_user.get("email"),
            "name": updated_user.get("name"),
            "profile_image": updated_user.get("profile_image"),
            "position": updated_user.get("position", ""),
            "specialization": updated_user.get("specialization", ""),
            "workgroup": updated_user.get("workgroup", ""),
            "degree": updated_user.get("degree", ""),
            "university": updated_user.get("university", ""),
            "experience": updated_user.get("experience", "")
        }
    
    async def _save_profile_image(self, email: str, base64_data: str) -> str:
        """
        Guarda la imagen de perfil en disco y retorna el nombre del archivo.
        
        Args:
            email: Email del usuario
            base64_data: Imagen en formato base64 (con o sin prefijo data:image/...)
        
        Returns:
            Nombre del archivo guardado
        """
        # Extraer el tipo de imagen y el contenido base64
        # Formato esperado: data:image/png;base64,iVBORw0KGgo...
        if ',' in base64_data:
            header, base64_content = base64_data.split(',', 1)
            # Extraer extensión del header (image/png -> png, image/jpeg -> jpg)
            match = re.search(r'image/(\w+)', header)
            extension = match.group(1) if match else 'jpg'
            # Normalizar jpeg a jpg
            if extension == 'jpeg':
                extension = 'jpg'
        else:
            # Si no tiene header, asumir que es base64 puro
            base64_content = base64_data
            extension = 'jpg'
        
        # Generar nombre único: email_timestamp.extension
        # Limpiar email para usar en nombre de archivo
        safe_email = email.replace('@', '_at_').replace('.', '_')
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{safe_email}_{timestamp}.{extension}"
        
        # Decodificar base64
        try:
            image_content = base64.b64decode(base64_content)
        except Exception as e:
            raise ValueError(f"Error al decodificar imagen base64: {str(e)}")
        
        # Guardar archivo en storage/profiles/
        self.storage.save_file(
            content=image_content,
            filename=filename,
            storage_location="profiles"
        )
        
        return filename
    
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
