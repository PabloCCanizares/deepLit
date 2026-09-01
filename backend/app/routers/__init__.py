"""
Routers de la aplicación.

Exporta funcion para incluir todos los routers.
"""

from fastapi import FastAPI

from app.routers import (
    ai_assistant,
    article_graph,
    articles,
    auth,
    clustering,
    collection_synthesis,
    collections,
    evidence_extraction,
    excels,
    health,
    openalex,
    papers,
    pdfs,
    redaction,
    research_intelligence,
    screening,
    stats,
    user,
)


def include_routers(app: FastAPI) -> None:
    """Incluye todos los routers de la aplicación."""
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
    app.include_router(evidence_extraction.router)
    app.include_router(clustering.router)
    app.include_router(ai_assistant.router)
    app.include_router(article_graph.router)
    app.include_router(papers.router)
    app.include_router(redaction.router)
    app.include_router(research_intelligence.router)


__all__ = ["include_routers"]
