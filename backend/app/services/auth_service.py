"""
Servicio de autenticación
"""
from datetime import datetime
from app.core.auth import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError
from app.repositories import UserRepository
from app.models import UserRegister, UserLogin

class AuthService:
    
    def __init__(self):
        self.user_repo = UserRepository()
    
    async def register(self, register_data: UserRegister) -> dict:
        """
        Registrar un nuevo usuario
        """
        # 1. Verificar si el email ya existe
        existing_user = await self.user_repo.find_by_email(register_data.email)
        if existing_user:
            raise ConflictError("El email ya está registrado")
        
        # 2. Crear el usuario
        user_dict = {
            "email": register_data.email,
            "password_hash": hash_password(register_data.password),
            "name": register_data.name or "",
            "created_at": datetime.utcnow()
        }
        
        await self.user_repo.create(user_dict)
        
        # 3. Devolver info del usuario (sin password)
        return {
            "email": register_data.email,
            "name": register_data.name
        }
    
    async def login(self, login_data: UserLogin) -> dict:
        """
        Iniciar sesión
        """
        # 1. Buscar usuario por email
        user = await self.user_repo.find_by_email(login_data.email)
        
        if not user:
            raise AuthenticationError("Email o contraseña incorrectos")
        
        # 2. Verificar contraseña
        if not verify_password(login_data.password, user["password_hash"]):
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


