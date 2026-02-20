"""
Controlador de PDFs.
"""
import logging
import shutil
from pathlib import Path
from fastapi import Depends, BackgroundTasks
from app.services.pdf_service import PdfService
from app.services.article_service import ArticleService, normalize_article
from app.services.extraction_service import ExtractionService
from app.services.collection_service import CollectionService
from app.services import StorageService
from app.ai_assistant.agents.specific_agents.pdf_processor import process_pdf
from app.models import PdfUpload
from app.core import StandardResponse
from typing import Optional
from pymongo import MongoClient
from app.config import settings

logger = logging.getLogger(__name__)


class PdfsController:
    
    def __init__(
        self,
        pdf_service: PdfService = Depends(),
        extraction_service: ExtractionService = Depends(),
        article_service: ArticleService = Depends(),
        collection_service: CollectionService = Depends()
    ):
        # Inyección de dependencias de los 3 services
        self.pdf_service = pdf_service
        self.extraction_service = extraction_service
        self.article_service = article_service
        self.collection_service = collection_service
    
    async def upload_pdf(
        self,
        pdf_data: PdfUpload,
        current_user: dict,
        background_tasks: BackgroundTasks
    ) -> StandardResponse:
        """
        Subir PDF, crear artículo placeholder y procesar en background.
        Responde inmediatamente; el procesamiento pesado ocurre en segundo plano.
        """
        user_id = current_user["_id"]
        collection_id = pdf_data.collection_id
        
        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={}
                )
        
        # PASO 1: Guardar PDF en disco y BD
        pdf_id, absolute_path = await self.pdf_service.save_pdf(pdf_data, user_id)
        
        # PASO 2: Crear artículo placeholder (status=processing) → respuesta inmediata
        article_id = await self.article_service.create_processing_article(
            pdf_id=pdf_id,
            user_id=user_id,
            filename=pdf_data.filename,
            collection_id=collection_id
        )
        
        # PASO 3: Encolar procesamiento pesado en background
        background_tasks.add_task(
            self._process_pdf_background,
            pdf_id=pdf_id,
            article_id=article_id,
            user_id=user_id,
            absolute_path=absolute_path,
            collection_id=collection_id,
            filename=pdf_data.filename
        )
        
        # Respuesta inmediata con placeholder
        return StandardResponse(
            success=True,
            message="PDF recibido. Procesando en segundo plano...",
            data={
                "id_pdf": pdf_id,
                "article": {
                    "_id": article_id,
                    "title": pdf_data.filename,
                    "status": "processing"
                }
            }
        )
    
    def _process_pdf_background(
        self,
        pdf_id: str,
        article_id: str,
        user_id: str,
        absolute_path: str,
        collection_id: Optional[str],
        filename: str
    ):
        """
        Procesamiento pesado en background, totalmente síncrono.
        En caso de error, solo hace rollback de archivos (no de BD).
        """
        faiss_index_path = str(
            Path(__file__).resolve().parents[2]
            / "storage" / "faiss_indexes" / str(user_id) / article_id
        )
        
        try:
            logger.info("Procesando PDF '%s' en background (pdf_id=%s)", filename, pdf_id)
            
            # RAG + metadata + FAISS (síncrono, pesado)
            processed_info = process_pdf(
                absolute_path,
                article_id=article_id,
                user_id=user_id
            )
            
            # Actualizar artículo usando PyMongo sincrónico
            self._update_article_sync(
                article_id=article_id,
                metadata=processed_info["metadata"]
            )
            
            logger.info("PDF '%s' procesado exitosamente (article_id=%s)", filename, article_id)
            
        except Exception as e:
            logger.error("Error procesando PDF '%s': %s. Iniciando rollback...", filename, e)
            self._rollback_files_only(absolute_path, faiss_index_path, pdf_id)
    
    def _update_article_sync(self, article_id: str, metadata: dict):
        """
        Actualizar artículo de forma sincrónica usando PyMongo.
        Se ejecuta desde el thread del background task.
        """
        try:
            # Conectar a MongoDB de forma sincrónica
            client = MongoClient(settings.MONGODB_URL)
            db = client[settings.DATABASE_NAME]
            articles_collection = db["articles"]
            
            # Normalizar metadata
            normalized = normalize_article(metadata)
            normalized["status"] = "ready"
            
            # Actualizar documento
            result = articles_collection.update_one(
                {"_id": article_id},
                {"$set": normalized}
            )
            
            client.close()
            
            if result.modified_count > 0:
                logger.info("Artículo actualizado sincronamente: %s", article_id)
            else:
                logger.warning("Artículo no encontrado o no actualizado: %s", article_id)
                
        except Exception as e:
            logger.error("Error actualizando artículo sincronamente: %s", e)
    
    def _rollback_files_only(
        self,
        absolute_path: str,
        faiss_index_path: str,
        pdf_id: str
    ):
        """
        Rollback sincrónico: solo elimina archivos de disco.
        Los registros en MongoDB se dejan intactos (el cliente puede reintentar o limpiar manualmente).
        """
        try:
            # 1. Borrar FAISS index de disco
            faiss_path = Path(faiss_index_path)
            if faiss_path.exists():
                shutil.rmtree(faiss_path, ignore_errors=True)
                logger.info("Rollback: FAISS index eliminado (%s)", faiss_index_path)
            
            # 2. Borrar archivo PDF de disco (si existe localmente)
            if absolute_path and Path(absolute_path).exists():
                try:
                    Path(absolute_path).unlink()
                    logger.info("Rollback: Archivo PDF eliminado (%s)", absolute_path)
                except Exception as e:
                    logger.warning("Rollback: Error al eliminar archivo local: %s", e)
            
            logger.info("Rollback de archivos completado para pdf_id=%s", pdf_id)
        except Exception as e:
            logger.error("Error critico durante rollback de archivos: %s", e)
