"""
Router de Papers.

Endpoints:
- POST   /papers                          - Crear paper (subir PDF a una colección)
- GET    /papers                          - Listar todos los papers del usuario
- GET    /papers/{id}                     - Obtener un paper por ID
- GET    /papers/{id}/pdf                 - Descargar el PDF de un paper
- GET    /papers/collection/{col_id}      - Listar papers de una colección
- PUT    /papers/{id}                     - Actualizar paper (título, notas)
- DELETE /papers/{id}                     - Eliminar paper
"""
from fastapi import APIRouter, Depends
from app.controllers.papers_controller import PapersController
from app.models.paper import PaperCreate, PaperUpdate
from app.core.auth import get_current_user
from app.core.responses import StandardResponse, create_response_examples

router = APIRouter(
    prefix="/papers",
    tags=["Papers"],
)


@router.post(
    "",
    response_model=StandardResponse,
    summary="Crear paper (subir PDF a una colección)",
    responses=create_response_examples(
        success_example={
            "message": "Paper creado exitosamente",
            "data": {
                "_id": "paper_my_paper_20241111120000",
                "collection_id": "col_ml_20241111120000",
                "title": "my_paper.pdf",
                "filename": "my_paper.pdf",
            },
        }
    ),
)
async def create_paper(
    paper_data: PaperCreate,
    current_user: dict = Depends(get_current_user),
    controller: PapersController = Depends(),
):
    """Subir un PDF como paper vinculado a una colección."""
    return await controller.create(paper_data, current_user)


@router.get(
    "",
    response_model=StandardResponse,
    summary="Listar papers del usuario",
)
async def get_papers(
    current_user: dict = Depends(get_current_user),
    controller: PapersController = Depends(),
):
    """Obtener todos los papers del usuario."""
    return await controller.get_all(current_user)


@router.get(
    "/collection/{collection_id}",
    response_model=StandardResponse,
    summary="Listar papers de una colección",
)
async def get_papers_by_collection(
    collection_id: str,
    current_user: dict = Depends(get_current_user),
    controller: PapersController = Depends(),
):
    """Obtener todos los papers de una colección."""
    return await controller.get_by_collection(collection_id, current_user)


@router.get(
    "/{paper_id}",
    response_model=StandardResponse,
    summary="Obtener un paper por ID",
)
async def get_paper(
    paper_id: str,
    current_user: dict = Depends(get_current_user),
    controller: PapersController = Depends(),
):
    """Obtener un paper por ID."""
    return await controller.get_by_id(paper_id, current_user)


@router.get(
    "/{paper_id}/pdf",
    summary="Descargar PDF de un paper",
    responses={200: {"content": {"application/pdf": {}}}},
)
async def get_paper_pdf(
    paper_id: str,
    current_user: dict = Depends(get_current_user),
    controller: PapersController = Depends(),
):
    """Descargar el archivo PDF de un paper."""
    return await controller.get_pdf(paper_id, current_user)


@router.put(
    "/{paper_id}",
    response_model=StandardResponse,
    summary="Actualizar paper",
)
async def update_paper(
    paper_id: str,
    update_data: PaperUpdate,
    current_user: dict = Depends(get_current_user),
    controller: PapersController = Depends(),
):
    """Actualizar título o notas de un paper."""
    return await controller.update(paper_id, update_data, current_user)


@router.delete(
    "/{paper_id}",
    response_model=StandardResponse,
    summary="Eliminar paper",
)
async def delete_paper(
    paper_id: str,
    current_user: dict = Depends(get_current_user),
    controller: PapersController = Depends(),
):
    """Eliminar un paper y su archivo PDF asociado."""
    return await controller.delete(paper_id, current_user)
