"""
OpenAlex.
"""
from fastapi import APIRouter, Depends
from app.controllers import OpenAlexController
from app.models import QueryBody, Pagination
from app.core import StandardResponse, create_response_examples, get_current_user
from typing import Optional


router = APIRouter(prefix="/openalex", tags=["OpenAlex"])

# ============================================
# RUTAS PROTEGIDAS (requieren autenticación)
# ============================================

@router.post(
    "/search",  # POST /openalex/search
    response_model=StandardResponse,
    summary="Buscar artículos del usuario",
    responses=create_response_examples(
        success_example={
            "message": "Artículos recuperados exitosamente",
            "data": [
                {
                    "_id": "article_123",
                    "title": "Título del artículo",
                    "abstract": "Resumen",
                    "year": "2024"
                }
            ]
        },
        error_example={
            "message": "Error al obtener artículos",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_user_articles(
    query: QueryBody,
    current_user: dict = Depends(get_current_user),
    controller: OpenAlexController = Depends()
):
    return await controller.get_openalex_articles(query)


@router.get(
    "/{openalex_id}", 
    response_model=StandardResponse,
    summary="Buscar artículos del usuario",
    responses=create_response_examples(
        success_example={
            "message": "Artículos recuperados exitosamente",
            "data": [
                {
                    "_id": "article_123",
                    "title": "Título del artículo",
                    "abstract": "Resumen",
                    "year": "2024"
                }
            ]
        },
        error_example={
            "message": "Error al obtener artículos",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def get_openalex_article_by_id(
    openalex_id: str,
    current_user: dict = Depends(get_current_user),
    controller: OpenAlexController = Depends()
):
    return await controller.get_by_id(openalex_id)


@router.post(
    "/{openalex_id}/save", 
    response_model=StandardResponse,
    summary="Buscar artículos del usuario",
    responses=create_response_examples(
        success_example={ #FIXME : cambiar ejemplo
            "message": "Artículos recuperados exitosamente",
            "data": [
                {
                    "_id": "article_123",
                    "title": "Título del artículo",
                    "abstract": "Resumen",
                    "year": "2024"
                }
            ]
        },
        error_example={
            "message": "Error al obtener artículos",
            "error": "Token inválido o expirado",
            "error_code": "INVALID_TOKEN"
        }
    )
)
async def save_openalex_article_by_id(
    openalex_id: str,
    collection_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    controller: OpenAlexController = Depends()
):
    # print("Obteniendo artículo de OpenAlex con ID:", openalex_id, "para guardarlo en la colección:", collection_id)
    return await controller.save_openalex_article_by_id(openalex_id, collection_id, current_user)




