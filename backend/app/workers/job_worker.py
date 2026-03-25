"""
Worker simple para jobs de backend.
"""
import asyncio
import logging
from typing import Optional

from app.services.article_service import ArticleService
from app.services.job_service import JobService, PDF_PROCESSING_JOB
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.services.pdf_processing_service import PdfProcessingService
from app.services.sse_manager import sse_manager
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


class JobWorker:
    def __init__(self, poll_interval_seconds: float = 5.0):
        self.poll_interval_seconds = poll_interval_seconds
        self.job_service = JobService()
        self.article_service = ArticleService()
        self.knowledge_graph_service = KnowledgeGraphService()
        self.pdf_processing_service = PdfProcessingService()
        self.storage_service = StorageService()
        self.handlers = {
            PDF_PROCESSING_JOB: self._process_pdf_job,
        }
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def register_handler(self, job_type: str, handler) -> None:
        self.handlers[job_type] = handler

    async def start(self) -> None:
        if self._task and not self._task.done():
            return

        recovered = await self.job_service.requeue_processing_jobs()
        if recovered:
            logger.info("Reencolados %s jobs PDF que quedaron en processing", recovered)

        self._running = True
        self._task = asyncio.create_task(self.run(), name="deeplit-job-worker")
        logger.info("Job worker iniciado")

    async def stop(self) -> None:
        self._running = False
        if not self._task:
            return

        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None

        try:
            self.knowledge_graph_service.mongo.close()
        except Exception:
            logger.debug("No se pudo cerrar cliente sync del knowledge graph", exc_info=True)

        logger.info("Job worker detenido")

    async def run(self) -> None:
        try:
            while self._running:
                job = await self.job_service.claim_next()
                if not job:
                    await asyncio.sleep(self.poll_interval_seconds)
                    continue

                await self._handle_job(job)
        except asyncio.CancelledError:
            logger.info("Loop del job worker cancelado")
            raise
        except Exception:
            logger.exception("Error inesperado en el loop del job worker")
            raise

    async def _handle_job(self, job: dict) -> None:
        job_id = str(job.get("_id"))
        job_type = str(job.get("type") or "").strip()
        handler = self.handlers.get(job_type)

        if handler is None:
            error_message = f"Tipo de job no soportado: {job_type or 'desconocido'}"
            logger.warning("Job %s ignorado. %s", job_id, error_message)
            await self.job_service.mark_failed(job_id, error_message)
            return

        await handler(job)

    async def _process_pdf_job(self, job: dict) -> None:
        payload = job.get("payload", {})
        job_id = str(job.get("_id"))
        article_id = payload.get("article_id")
        user_id = payload.get("user_id")
        absolute_path = payload.get("absolute_path")
        filename = payload.get("filename") or article_id or "PDF"
        collection_id = payload.get("collection_id")

        try:
            logger.info("Procesando job PDF %s para article_id=%s", job_id, article_id)

            processed_info = await asyncio.to_thread(
                self.pdf_processing_service.process_pdf,
                absolute_path,
                article_id=article_id,
                user_id=user_id,
            )

            updated_article = await self.article_service.update_from_processing(
                article_id=article_id,
                user_id=user_id,
                features=processed_info["metadata"],
            )
            if not updated_article:
                raise RuntimeError(f"No se pudo actualizar el articulo {article_id}")

            try:
                await asyncio.to_thread(
                    self.knowledge_graph_service.ingest_documents,
                    user_id=user_id,
                    article_id=article_id,
                    title=updated_article.get("title", filename),
                    docs=processed_info.get("docs", []),
                    collection_ids=updated_article.get("collection_ids", []) or (
                        [] if not collection_id else [collection_id]
                    ),
                    reprocess=True,
                )
            except Exception as kg_exc:
                logger.warning(
                    "Knowledge graph no actualizado para %s: %s",
                    article_id,
                    kg_exc,
                )

            await self.job_service.mark_completed(job_id)

            sse_manager.notify(
                user_id,
                "article_ready",
                {
                    "_id": article_id,
                    "title": updated_article.get("title", filename),
                    "status": "ready",
                    "year": updated_article.get("year"),
                    "category": updated_article.get("category"),
                    "pages": updated_article.get("pages"),
                },
            )
            logger.info("Job PDF %s completado", job_id)
        except Exception as exc:
            logger.exception("Error procesando job PDF %s", job_id)
            self._cleanup_partial_faiss_index(user_id=user_id, article_id=article_id)

            try:
                await self.article_service.mark_processing_error(
                    article_id=article_id,
                    user_id=user_id,
                    error_message=str(exc),
                )
            except Exception:
                logger.warning(
                    "No se pudo marcar el articulo %s como error",
                    article_id,
                    exc_info=True,
                )

            try:
                await self.job_service.mark_failed(job_id, str(exc))
            except Exception:
                logger.warning(
                    "No se pudo marcar el job %s como failed",
                    job_id,
                    exc_info=True,
                )

            sse_manager.notify(
                user_id,
                "article_error",
                {
                    "_id": article_id,
                    "title": filename,
                    "status": "error",
                    "error_message": str(exc),
                },
            )

    def _cleanup_partial_faiss_index(self, user_id: str, article_id: str) -> None:
        faiss_index_path = self.storage_service.get_faiss_article_dir(user_id=str(user_id), article_id=str(article_id))
        if self.storage_service.delete_directory(faiss_index_path):
            logger.info("Indice FAISS parcial eliminado: %s", faiss_index_path)
