"""
Routers de la aplicación.

Exporta funcion para incluir todos los routers.
"""
from fastapi import FastAPI
from app.routers import auth, health, pdf, user, article


def include_routers(app: FastAPI) -> None:
    """
    Incluye todos los routers de la aplicación.
    """
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(pdf.router)
    app.include_router(user.router)
    app.include_router(article.router)

__all__ = ["include_routers"]
