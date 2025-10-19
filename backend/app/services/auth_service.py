"""
Servicio de autenticación
"""
from datetime import datetime
from app.core.auth import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError
from app.repositories import UserRepository
from app.models.user import UserRegister

class AuthService:
    
    def __init__(self):
        self.user_repo = UserRepository()
    
    async def register(self, user_data: UserRegister) -> dict:
        """
        Registrar un nuevo usuario
        """
        # 1. Verificar si el email ya existe
        existing_user = await self.user_repo.find_by_email(user_data.email)
        if existing_user:
            raise ConflictError("El email ya está registrado")
        
        # 2. Crear el usuario
        user_dict = {
            "email": user_data.email,
            "password_hash": hash_password(user_data.password),
            "name": user_data.name or "",
            "created_at": datetime.utcnow()
        }
        
        await self.user_repo.create(user_dict)
        
        # 3. Devolver info del usuario (sin password)
        return {
            "email": user_data.email,
            "name": user_data.name
        }
    
    async def login(self, email: str, password: str) -> dict:
        """
        Iniciar sesión
        """
        # 1. Buscar usuario por email
        user = await self.user_repo.find_by_email(email)
        
        if not user:
            raise AuthenticationError("Email o contraseña incorrectos")
        
        # 2. Verificar contraseña
        if not verify_password(password, user["password_hash"]):
            raise AuthenticationError("Email o contraseña incorrectos")
        
        # 3. Crear token
        access_token = create_access_token(user["email"])
        
        # 4. Devolver token y datos del usuario
        return {
            "token": access_token,
            "user": {
                "email": user["email"],
                "name": user.get("name", ""),
                "profileImage": user.get("profileImage", None)
            }
        }

    async def update_profile(self, email: str, name: str, profile_image: str = None) -> dict:
        """
        Actualizar perfil del usuario (nombre e imagen)
        """
        # 1. Buscar usuario
        user = await self.user_repo.find_by_email(email)
        if not user:
            raise AuthenticationError("Usuario no encontrado")
        
        # 2. Actualizar datos
        update_data = {
            "name": name,
            "updated_at": datetime.utcnow()
        }
        
        if profile_image:
            update_data["profileImage"] = profile_image
        
        # 3. Guardar en BD
        await self.user_repo.update_by_email(email, update_data)
        
        # 4. Obtener usuario actualizado
        updated_user = await self.user_repo.find_by_email(email)
        
        # 5. Devolver datos del usuario
        return {
            "email": updated_user["email"],
            "name": updated_user.get("name", ""),
            "profileImage": updated_user.get("profileImage", None)
        }
    
    async def change_password(self, email: str, current_password: str, new_password: str) -> dict:
        """
        Cambiar contraseña del usuario
        """
        # 1. Buscar usuario
        user = await self.user_repo.find_by_email(email)
        if not user:
            raise AuthenticationError("Usuario no encontrado")
        
        # 2. Verificar contraseña actual
        if not verify_password(current_password, user["password_hash"]):
            raise AuthenticationError("La contraseña actual es incorrecta")
        
        # 3. Actualizar contraseña
        update_data = {
            "password_hash": hash_password(new_password),
            "updated_at": datetime.utcnow()
        }
        
        await self.user_repo.update_by_email(email, update_data)
        
        return {
            "message": "Contraseña actualizada exitosamente"
        }

