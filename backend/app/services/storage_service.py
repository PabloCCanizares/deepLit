"""
Servicio de almacenamiento de archivos.

Este servicio centraliza toda la lógica de gestión de archivos (lectura, escritura, eliminación).
Ventajas:
- Rutas centralizadas y configurables
- Fácil migrar a cloud storage (S3, Azure, etc.) en el futuro
- Código más limpio y mantenible
"""
import logging
import shutil
from pathlib import Path
from typing import Literal
from app.config import settings


# Tipos de almacenamiento disponibles
StorageLocation = Literal["uploads", "profiles", "collections", "faiss_indexes", "faiss_metadata"]
logger = logging.getLogger(__name__)


class StorageService:
    """
    Servicio para gestionar archivos en disco.
    
    Estructura de directorios:
    storage/
    ├── uploads/      # PDFs permanentes de usuarios
    ├── profiles/     # Fotos de perfil de usuarios
    ├── collections/  # Imágenes de colecciones
    ├── faiss_indexes/   # Índices FAISS por artículo
    └── faiss_metadata/  # Índices FAISS construidos desde metadatos
    """
    
    def __init__(self):
        """
        Inicializa el servicio y crea los directorios si no existen.
        """
        self.base_dir = Path(settings.STORAGE_BASE_DIR)
        
        # Mapeo de tipos de almacenamiento a sus directorios
        self.storage_paths = {
            "uploads": self.base_dir / settings.UPLOADS_DIR,
            "profiles": self.base_dir / settings.PROFILES_DIR,
            "collections": self.base_dir / settings.COLLECTIONS_DIR,
            "faiss_indexes": self.base_dir / "faiss_indexes",
            "faiss_metadata": self.base_dir / "faiss_metadata",
        }
        
        # Crear todos los directorios al inicializar
        self._ensure_directories()
    
    def _ensure_directories(self) -> None:
        """Crea todos los directorios de almacenamiento si no existen."""
        for directory in self.storage_paths.values():
            directory.mkdir(parents=True, exist_ok=True)
    
    def save_file(
        self, 
        content: bytes, 
        filename: str, 
        storage_location: StorageLocation = "uploads"
    ) -> str:
        """
        Guarda un archivo en el almacenamiento.
        """
        file_path = self.get_path(filename, storage_location)
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        return str(file_path)
    
    def read_file(self, filename: str, storage_location: StorageLocation = "uploads") -> bytes:
        """
        Lee un archivo del almacenamiento.
        """
        file_path = self.get_path(filename, storage_location)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {filename}")
        
        with open(file_path, "rb") as f:
            return f.read()
    
    def exists(self, filename: str, storage_location: StorageLocation = "uploads") -> bool:
        """
        Verifica si un archivo existe.
        """
        file_path = self.get_path(filename, storage_location)
        return file_path.exists()
    
    def delete_file(self, filename: str, storage_location: StorageLocation = "uploads") -> bool:
        """
        Elimina un archivo del almacenamiento.
        """
        file_path = self.get_path(filename, storage_location)
        
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info("Archivo eliminado correctamente: %s", filename)
                return True
            return False
        except Exception as exc:
            logger.warning("Error al eliminar archivo %s: %s", filename, exc)
            return False
    
    def get_path(self, filename: str, storage_location: StorageLocation = "uploads") -> Path:
        """
        Obtiene la ruta completa de un archivo.
        """
        return self.storage_paths[storage_location] / filename

    def get_directory(self, storage_location: StorageLocation) -> Path:
        """
        Obtiene la ruta base de una ubicación de almacenamiento.
        """
        return self.storage_paths[storage_location]

    def get_faiss_article_dir(self, user_id: str, article_id: str) -> Path:
        """
        Obtiene la carpeta del índice FAISS de un artículo.
        """
        return self.get_directory("faiss_indexes") / str(user_id) / str(article_id)

    def get_faiss_metadata_dir(self, user_id: str, collection_id: str | None = None) -> Path:
        """
        Obtiene la carpeta del índice FAISS construido desde metadatos.
        """
        scope_dir = collection_id or "__all__"
        return self.get_directory("faiss_metadata") / str(user_id) / scope_dir

    def delete_directory(self, directory: Path) -> bool:
        """
        Elimina un directorio completo si existe.
        """
        try:
            if directory.exists():
                shutil.rmtree(directory, ignore_errors=True)
                logger.info("Directorio eliminado correctamente: %s", directory)
                return True
            return False
        except Exception as exc:
            logger.warning("Error al eliminar directorio %s: %s", directory, exc)
            return False
