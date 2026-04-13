"""
Routers de la aplicación.

Exporta funcion para incluir todos los routers.
"""
from fastapi import FastAPI
from app.routers import ai_assistant, auth, health, pdfs, excels, articles, stats, user, openalex, collections, knowledge_graph, screening, collection_synthesis


def include_routers(app: FastAPI) -> None:
    """
    Incluye todos los routers de la aplicación.
    """
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(user.router)
    app.include_router(pdfs.router)
    app.include_router(excels.router)
    app.include_router(articles.router)
    app.include_router(stats.router)
    app.include_router(openalex.router)
    app.include_router(collections.router)
    app.include_router(screening.router)
    app.include_router(collection_synthesis.router)
    app.include_router(ai_assistant.router)
    app.include_router(knowledge_graph.router)

__all__ = ["include_routers"]
