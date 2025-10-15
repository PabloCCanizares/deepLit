"""
Routers de la aplicación.

Exporta funcion para incluir todos los routers.
"""
from fastapi import FastAPI
from app.routers import auth, health, upload


def include_routers(app: FastAPI) -> None:
    """
    Incluye todos los routers de la aplicación.
    """
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(upload.router)

__all__ = ["include_routers"]
