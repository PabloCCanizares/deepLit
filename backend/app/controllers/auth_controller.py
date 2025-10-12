"""
Controlador de autenticación
"""
from fastapi import Depends
from app.services.auth_service import AuthService
from app.models.user import UserRegister, UserLogin
from app.core import StandardResponse


class AuthController:
    
    def __init__(self, service: AuthService = Depends()):
        self.service = service
    
    async def register(self, user_data: UserRegister) -> StandardResponse:
        """
        Registrar nuevo usuario.
        
        Si el email ya existe, el service lanza ConflictError.
        """
        user = await self.service.register(user_data)
        return StandardResponse(
            success=True,
            message="Usuario registrado exitosamente",
            data=user
        )
    
    async def login(self, login_data: UserLogin) -> StandardResponse:
        """
        Iniciar sesión.
        
        Si las credenciales son incorrectas, el service lanza AuthenticationError.
        """
        result = await self.service.login(login_data.email, login_data.password)
        return StandardResponse(
            success=True,
            message="Login exitoso",
            data=result
        )
    
    async def get_user_info(self, current_user: dict) -> StandardResponse:
        """Obtener info del usuario actual"""
        return StandardResponse(
            success=True,
            message="Usuario obtenido",
            data={
                "email": current_user["email"],
                "name": current_user.get("name", "")
            }
        )
    
    async def logout(self, current_user: dict) -> StandardResponse:
        """
        Cerrar sesión.
        """
        return StandardResponse(
            success=True,
            message="Sesión cerrada exitosamente",
            data={"email": current_user["email"]}
        )

