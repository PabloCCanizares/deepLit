"""
Controlador de Papers.
"""
import logging

from fastapi import Depends
from fastapi.responses import Response

from app.core import StandardResponse
from app.models.paper import PaperCreate, PaperUpdate
from app.services.paper_service import PaperService

logger = logging.getLogger(__name__)


class PapersController:

    def __init__(self, paper_service: PaperService = Depends()):
        self.paper_service = paper_service

    async def create(self, paper_data: PaperCreate, current_user: dict) -> StandardResponse:
        """Subir un PDF como paper vinculado a una colección."""
        user_id = current_user["_id"]
        paper = await self.paper_service.create(paper_data, user_id)
        return StandardResponse(
            success=True,
            message="Paper creado exitosamente",
            data=paper,
        )

    async def get_by_id(self, paper_id: str, current_user: dict) -> StandardResponse:
        """Obtener un paper por ID."""
        user_id = current_user["_id"]
        paper = await self.paper_service.get_by_id(paper_id, user_id)
        return StandardResponse(
            success=True,
            message="Paper recuperado exitosamente",
            data=paper,
        )

    async def get_by_collection(self, collection_id: str, current_user: dict) -> StandardResponse:
        """Obtener papers de una colección."""
        user_id = current_user["_id"]
        papers = await self.paper_service.get_by_collection(collection_id, user_id)
        return StandardResponse(
            success=True,
            message="Papers recuperados exitosamente",
            data={"papers": papers, "total": len(papers)},
        )

    async def get_all(self, current_user: dict) -> StandardResponse:
        """Obtener todos los papers del usuario."""
        user_id = current_user["_id"]
        papers = await self.paper_service.get_by_user(user_id)
        return StandardResponse(
            success=True,
            message="Papers recuperados exitosamente",
            data={"papers": papers, "total": len(papers)},
        )

    async def update(self, paper_id: str, update_data: PaperUpdate, current_user: dict) -> StandardResponse:
        """Actualizar un paper."""
        user_id = current_user["_id"]
        paper = await self.paper_service.update(paper_id, update_data, user_id)
        return StandardResponse(
            success=True,
            message="Paper actualizado exitosamente",
            data=paper,
        )

    async def delete(self, paper_id: str, current_user: dict) -> StandardResponse:
        """Eliminar un paper."""
        user_id = current_user["_id"]
        await self.paper_service.delete(paper_id, user_id)
        return StandardResponse(
            success=True,
            message="Paper eliminado exitosamente",
            data={},
        )

    async def get_pdf(self, paper_id: str, current_user: dict) -> Response:
        """Descargar el PDF de un paper."""
        user_id = current_user["_id"]
        content, filename = await self.paper_service.get_pdf_content(paper_id, user_id)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
