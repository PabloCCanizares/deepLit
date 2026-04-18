"""
Servicio de Papers.
"""
import base64
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from app.repositories.paper_repository import PaperRepository
from app.repositories.collection_repository import CollectionRepository
from app.models.paper import PaperCreate, PaperUpdate
from app.services.storage_service import StorageService
from app.core import NotFoundError, AuthorizationError

logger = logging.getLogger(__name__)


class PaperService:

    def __init__(self):
        self.paper_repo = PaperRepository()
        self.collection_repo = CollectionRepository()
        self.storage = StorageService()

    async def create(self, paper_data: PaperCreate, user_id: str) -> Dict:
        """
        Crear un paper: guardar PDF en disco y crear registro en BD
        vinculado a la colección.
        """
        collection_id = paper_data.collection_id

        # Verificar que la colección existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        if not collection or collection.get("id_user") != user_id:
            raise NotFoundError("Colección no encontrada")

        # Generar ID único
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        original_filename = paper_data.filename
        if original_filename.lower().endswith(".pdf"):
            original_filename = original_filename[:-4]

        paper_id = f"paper_{original_filename}_{timestamp}"
        unique_filename = f"{paper_id}.pdf"

        # Decodificar contenido base64
        decoded_content = base64.b64decode(paper_data.content)

        # Guardar archivo en disco
        save_path = self.storage.save_file(
            content=decoded_content,
            filename=unique_filename,
            storage_location="uploads",
        )
        absolute_path = str(Path(save_path).resolve())

        now = datetime.now(timezone.utc).isoformat()

        paper_dict = {
            "_id": paper_id,
            "id_user": user_id,
            "collection_id": collection_id,
            "title": paper_data.title or paper_data.filename,
            "filename": paper_data.filename,
            "file_path": absolute_path,
            "notes": paper_data.notes,
            "created_at": now,
            "updated_at": now,
        }

        await self.paper_repo.create(paper_dict)
        return paper_dict

    async def get_by_id(self, paper_id: str, user_id: str) -> Dict:
        """Obtener un paper por ID, verificando pertenencia al usuario."""
        paper = await self.paper_repo.find_by_id(paper_id)
        if not paper:
            raise NotFoundError("Paper no encontrado")
        if paper.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a este paper")
        return paper

    async def get_by_collection(self, collection_id: str, user_id: str) -> List[Dict]:
        """Obtener todos los papers de una colección."""
        # Verificar que la colección existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        if not collection or collection.get("id_user") != user_id:
            raise NotFoundError("Colección no encontrada")

        return await self.paper_repo.find_by_collection(collection_id, user_id)

    async def get_by_user(self, user_id: str) -> List[Dict]:
        """Obtener todos los papers de un usuario."""
        return await self.paper_repo.find_by_user(user_id)

    async def update(self, paper_id: str, update_data: PaperUpdate, user_id: str) -> Dict:
        """Actualizar un paper (título, notas)."""
        paper = await self.paper_repo.find_by_id(paper_id)
        if not paper:
            raise NotFoundError("Paper no encontrado")
        if paper.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este paper")

        update_dict = update_data.model_dump(exclude_none=True)
        if not update_dict:
            return paper

        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        updated = await self.paper_repo.update(paper_id, update_dict)
        return updated

    async def delete(self, paper_id: str, user_id: str) -> bool:
        """Eliminar un paper: archivo del disco + registro en BD."""
        paper = await self.paper_repo.find_by_id(paper_id)
        if not paper:
            raise NotFoundError("Paper no encontrado")
        if paper.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para eliminar este paper")

        # Eliminar archivo del disco
        file_path = paper.get("file_path")
        if file_path:
            try:
                path = Path(file_path)
                if path.exists():
                    path.unlink()
            except Exception as exc:
                logger.warning("Error eliminando archivo de paper %s: %s", paper_id, exc)

        return await self.paper_repo.delete(paper_id)

    async def get_pdf_content(self, paper_id: str, user_id: str) -> tuple:
        """
        Obtener el contenido binario del PDF de un paper.
        Retorna (bytes, filename).
        """
        paper = await self.get_by_id(paper_id, user_id)
        file_path = paper.get("file_path")
        if not file_path:
            raise NotFoundError("Archivo PDF no encontrado para este paper")

        path = Path(file_path)
        if not path.exists():
            raise NotFoundError("Archivo PDF no encontrado en disco")

        content = path.read_bytes()
        return content, paper.get("filename", "paper.pdf")
