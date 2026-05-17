"""
Worker simple para jobs de backend.
"""
import asyncio
import logging
from typing import Optional

from app.services.article_service import ArticleService
from app.services.article_graph_service import ArticleGraphService
from app.services.clustering_run_service import ClusteringRunService
from app.services.clustering_service import ClusteringService
from app.services.evidence_extraction_run_service import EvidenceExtractionRunService
from app.services.evidence_extraction_service import EvidenceExtractionService
from app.services.screening_run_service import ScreeningRunService
from app.services.collection_screening_service import CollectionScreeningService
from app.services.collection_synthesis_service import CollectionSynthesisService
from app.services.collection_synthesis_run_service import CollectionSynthesisRunService
from app.services.job_service import (
    JobService,
    PDF_PROCESSING_JOB,
    COLLECTION_SCREENING_JOB,
    COLLECTION_SYNTHESIS_JOB,
    EVIDENCE_EXTRACTION_JOB,
    CLUSTERING_JOB,
)
from app.services.pdf_processing_service import PdfProcessingService
from app.services.sse_manager import sse_manager
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


class JobWorker:
    def __init__(self, poll_interval_seconds: float = 5.0):
        self.poll_interval_seconds = poll_interval_seconds
        self.job_service = JobService()
        self.article_service = ArticleService()
        self.evidence_extraction_run_service = EvidenceExtractionRunService()
        self.evidence_extraction_service = EvidenceExtractionService()
        self.clustering_run_service = ClusteringRunService()
        self.clustering_service = ClusteringService()
        self.screening_run_service = ScreeningRunService()
        self.collection_screening_service = CollectionScreeningService()
        self.collection_synthesis_service = CollectionSynthesisService()
        self.collection_synthesis_run_service = CollectionSynthesisRunService()
        self.pdf_processing_service = PdfProcessingService()
        self.article_graph_service = ArticleGraphService()
        self.storage_service = StorageService()
        self.handlers = {
            PDF_PROCESSING_JOB: self._process_pdf_job,
            COLLECTION_SCREENING_JOB: self._process_screening_job,
            COLLECTION_SYNTHESIS_JOB: self._process_collection_synthesis_job,
            EVIDENCE_EXTRACTION_JOB: self._process_evidence_extraction_job,
            CLUSTERING_JOB: self._process_clustering_job,
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
            logger.info("Reencolados %s jobs que quedaron en processing", recovered)

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

    async def _refresh_embeddings(self, user_id: str) -> None:
        """Recalcula embeddings del grafo para el usuario (best-effort, no bloquea el worker)."""
        try:
            result = await asyncio.to_thread(
                self.article_graph_service.compute_embeddings,
                user_id,
            )
            if result.get("success"):
                written = result.get("embeddings_written", 0)
                if written:
                    logger.info("Embeddings calculados para user_id=%s: %s nodos nuevos", user_id, written)
            else:
                logger.debug("compute_embeddings sin cambios para user_id=%s: %s", user_id, result.get("reason"))
        except Exception as exc:
            logger.warning("No se pudieron calcular embeddings para user_id=%s: %s", user_id, exc)

    async def _process_pdf_job(self, job: dict) -> None:
        payload = job.get("payload", {})
        job_id = str(job.get("_id"))
        article_id = payload.get("article_id")
        user_id = payload.get("user_id")
        absolute_path = payload.get("absolute_path")
        filename = payload.get("filename") or article_id or "PDF"
        collection_id = payload.get("collection_id")

        if not article_id:
            logger.error(
                "Job PDF %s no tiene article_id en el payload. Marcando como fallido.", job_id
            )
            await self.job_service.mark_failed(
                job_id, "Payload inválido: falta article_id"
            )
            return

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
                logger.warning(
                    "Artículo %s no encontrado al actualizar tras procesamiento "
                    "(puede haber sido eliminado). Marcando job %s como fallido.",
                    article_id,
                    job_id,
                )
                await self.job_service.mark_failed(
                    job_id,
                    f"Artículo {article_id} no encontrado al actualizar (puede haber sido eliminado)",
                )
                sse_manager.notify(
                    user_id,
                    "article_error",
                    {
                        "_id": article_id,
                        "title": filename,
                        "status": "error",
                        "error_message": "Artículo eliminado durante el procesamiento",
                    },
                )
                return

            await self.job_service.mark_completed(job_id)
            asyncio.create_task(self._refresh_embeddings(user_id))

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

    async def _process_screening_job(self, job: dict) -> None:
        payload = job.get("payload", {})
        job_id = str(job.get("_id"))
        user_id = payload.get("user_id")
        run_id = payload.get("run_id")
        collection_id = payload.get("collection_id")
        research_question = payload.get("research_question")
        inclusion_criteria = payload.get("inclusion_criteria") or []
        exclusion_criteria = payload.get("exclusion_criteria") or []

        try:
            logger.info(
                "Procesando job screening %s para collection_id=%s",
                job_id,
                collection_id,
            )

            await self.screening_run_service.mark_processing(
                run_id=run_id,
                user_id=user_id,
            )

            summary = await self.collection_screening_service.run_collection_screening(
                run_id=run_id,
                user_id=user_id,
                collection_id=collection_id,
                research_question=research_question,
                inclusion_criteria=inclusion_criteria,
                exclusion_criteria=exclusion_criteria,
            )

            await self.job_service.mark_completed(job_id)
            await self.screening_run_service.mark_completed(
                run_id=run_id,
                user_id=user_id,
                total_articles=summary["total_articles"],
                processed_articles=summary["processed_articles"],
                counts=summary["counts"],
            )

            sse_manager.notify(
                user_id,
                "screening_ready",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "research_question": research_question,
                    "status": "completed",
                    "summary": summary,
                },
            )
            logger.info("Job screening %s completado", job_id)
        except Exception as exc:
            logger.exception("Error procesando job screening %s", job_id)

            try:
                await self.job_service.mark_failed(job_id, str(exc))
            except Exception:
                logger.warning(
                    "No se pudo marcar el job %s como failed",
                    job_id,
                    exc_info=True,
                )

            try:
                await self.screening_run_service.mark_failed(
                    run_id=run_id,
                    user_id=user_id,
                    error_message=str(exc),
                )
            except Exception:
                logger.warning(
                    "No se pudo marcar el run %s como failed",
                    run_id,
                    exc_info=True,
                )

            sse_manager.notify(
                user_id,
                "screening_error",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "research_question": research_question,
                    "status": "failed",
                    "error_message": str(exc),
                },
            )

    async def _process_collection_synthesis_job(self, job: dict) -> None:
        payload = job.get("payload", {})
        job_id = str(job.get("_id"))
        user_id = payload.get("user_id")
        run_id = payload.get("run_id")
        collection_id = payload.get("collection_id")
        prompt = payload.get("prompt")

        try:
            logger.info(
                "Procesando job collection synthesis %s para collection_id=%s",
                job_id,
                collection_id,
            )

            await self.collection_synthesis_run_service.mark_processing(
                run_id=run_id,
                user_id=user_id,
            )

            result = await self.collection_synthesis_service.synthesize_collection(
                user_message=prompt,
                user_id=user_id,
                collection_id=collection_id,
                fail_on_timeout=True,
            )

            await self.job_service.mark_completed(job_id)
            run = await self.collection_synthesis_run_service.mark_completed(
                run_id=run_id,
                user_id=user_id,
                response=result.get("reply") or "",
                context_source=result.get("context_source"),
                prompt_version=result.get("prompt_version"),
            )

            sse_manager.notify(
                user_id,
                "collection_synthesis_ready",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "prompt": prompt,
                    "status": "completed",
                    "run": run,
                },
            )
            logger.info("Job collection synthesis %s completado", job_id)
        except Exception as exc:
            logger.exception("Error procesando job collection synthesis %s", job_id)

            try:
                await self.job_service.mark_failed(job_id, str(exc))
            except Exception:
                logger.warning(
                    "No se pudo marcar el job %s como failed",
                    job_id,
                    exc_info=True,
                )

            try:
                await self.collection_synthesis_run_service.mark_failed(
                    run_id=run_id,
                    user_id=user_id,
                    error_message=str(exc),
                )
            except Exception:
                logger.warning(
                    "No se pudo marcar la sintesis %s como failed",
                    run_id,
                    exc_info=True,
                )

            sse_manager.notify(
                user_id,
                "collection_synthesis_error",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "prompt": prompt,
                    "status": "failed",
                    "error_message": str(exc),
                },
            )

    async def _process_evidence_extraction_job(self, job: dict) -> None:
        payload = job.get("payload", {})
        job_id = str(job.get("_id"))
        user_id = payload.get("user_id")
        run_id = payload.get("run_id")
        collection_id = payload.get("collection_id")
        screening_run_id = payload.get("screening_run_id")
        selection_mode = payload.get("selection_mode") or "all"

        try:
            logger.info(
                "Procesando job evidence extraction %s para collection_id=%s",
                job_id,
                collection_id,
            )

            await self.evidence_extraction_run_service.mark_processing(
                run_id=run_id,
                user_id=user_id,
            )

            summary = await self.evidence_extraction_service.run_evidence_extraction(
                run_id=run_id,
                user_id=user_id,
                collection_id=collection_id,
                screening_run_id=screening_run_id,
                selection_mode=selection_mode,
            )

            await self.job_service.mark_completed(job_id)
            run = await self.evidence_extraction_run_service.mark_completed(
                run_id=run_id,
                user_id=user_id,
                total_articles=summary["total_articles"],
                processed_articles=summary["processed_articles"],
                prompt_version=summary["prompt_version"],
                schema_version=summary["schema_version"],
            )

            sse_manager.notify(
                user_id,
                "evidence_extraction_ready",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "screening_run_id": screening_run_id,
                    "selection_mode": selection_mode,
                    "status": "completed",
                    "run": run,
                },
            )
            logger.info("Job evidence extraction %s completado", job_id)
        except Exception as exc:
            logger.exception("Error procesando job evidence extraction %s", job_id)

            try:
                await self.job_service.mark_failed(job_id, str(exc))
            except Exception:
                logger.warning(
                    "No se pudo marcar el job %s como failed",
                    job_id,
                    exc_info=True,
                )

            try:
                await self.evidence_extraction_run_service.mark_failed(
                    run_id=run_id,
                    user_id=user_id,
                    error_message=str(exc),
                )
            except Exception:
                logger.warning(
                    "No se pudo marcar el run %s como failed",
                    run_id,
                    exc_info=True,
                )

            sse_manager.notify(
                user_id,
                "evidence_extraction_error",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "screening_run_id": screening_run_id,
                    "selection_mode": selection_mode,
                    "status": "failed",
                    "error_message": str(exc),
                },
            )

    async def _process_clustering_job(self, job: dict) -> None:
        payload = job.get("payload", {})
        job_id = str(job.get("_id"))
        user_id = payload.get("user_id")
        run_id = payload.get("run_id")
        collection_id = payload.get("collection_id")
        evidence_extraction_run_id = payload.get("evidence_extraction_run_id")
        requested_cluster_count = payload.get("requested_cluster_count")

        try:
            logger.info(
                "Procesando job clustering %s para collection_id=%s",
                job_id,
                collection_id,
            )

            await self.clustering_run_service.mark_processing(
                run_id=run_id,
                user_id=user_id,
            )

            summary = await self.clustering_service.run_clustering(
                run_id=run_id,
                user_id=user_id,
                evidence_extraction_run_id=evidence_extraction_run_id,
                requested_cluster_count=requested_cluster_count,
            )

            await self.job_service.mark_completed(job_id)
            run = await self.clustering_run_service.mark_completed(
                run_id=run_id,
                user_id=user_id,
                total_articles=summary["total_articles"],
                processed_articles=summary["processed_articles"],
                selected_cluster_count=summary["selected_cluster_count"],
                algorithm_version=summary["algorithm_version"],
                silhouette_score=summary["silhouette_score"],
                clusters=summary["clusters"],
            )

            sse_manager.notify(
                user_id,
                "clustering_ready",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "evidence_extraction_run_id": evidence_extraction_run_id,
                    "status": "completed",
                    "run": run,
                },
            )
            logger.info("Job clustering %s completado", job_id)
        except Exception as exc:
            logger.exception("Error procesando job clustering %s", job_id)

            try:
                await self.job_service.mark_failed(job_id, str(exc))
            except Exception:
                logger.warning(
                    "No se pudo marcar el job %s como failed",
                    job_id,
                    exc_info=True,
                )

            try:
                await self.clustering_run_service.mark_failed(
                    run_id=run_id,
                    user_id=user_id,
                    error_message=str(exc),
                )
            except Exception:
                logger.warning(
                    "No se pudo marcar el run %s como failed",
                    run_id,
                    exc_info=True,
                )

            sse_manager.notify(
                user_id,
                "clustering_error",
                {
                    "run_id": run_id,
                    "job_id": job_id,
                    "collection_id": collection_id,
                    "evidence_extraction_run_id": evidence_extraction_run_id,
                    "requested_cluster_count": requested_cluster_count,
                    "status": "failed",
                    "error_message": str(exc),
                },
            )

    def _cleanup_partial_faiss_index(self, user_id: str, article_id: str) -> None:
        faiss_index_path = self.storage_service.get_faiss_article_dir(user_id=str(user_id), article_id=str(article_id))
        if self.storage_service.delete_directory(faiss_index_path):
            logger.info("Indice FAISS parcial eliminado: %s", faiss_index_path)
