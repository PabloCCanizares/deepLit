"""
Controlador de autenticación.

Responsabilidad: SOLO autenticación (register, login, logout).
"""
from fastapi import Depends
from app.services.auth_service import AuthService
from app.models import UserRegister, UserLogin
from app.core import StandardResponse
from app.services.collection_service import CollectionService

class AuthController:
    
    def __init__(self, service: AuthService = Depends()):
        self.service = service
        self.collection_service = CollectionService()
    
    async def register(self, register_data: UserRegister) -> StandardResponse:
        """
        Registrar nuevo usuario.
        """
        user = await self.service.register(register_data)
        if user:
            await self.collection_service.create(
                user_id=user["user_id"],
                name="Artículos sin colección",
                description="Artículos sin colección",
                color="#FFD700",
                image=None,
                collection_id=user["user_id"]
            )

        return StandardResponse(
            success=True,
            message="Usuario registrado exitosamente",
            data=user
        )
    
    async def login(self, login_data: UserLogin) -> StandardResponse:
        """
        Iniciar sesión.
        """
        result = await self.service.login(login_data)
        return StandardResponse(
            success=True,
            message="Login exitoso",
            data=result
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

