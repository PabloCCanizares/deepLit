"""
Controlador de PDFs.
"""
import logging
from pathlib import Path

from fastapi import Depends

from app.core import StandardResponse
from app.models import PdfUpload
from app.services.article_service import ArticleService
from app.services.collection_service import CollectionService
from app.services.job_service import JobService
from app.services.pdf_service import PdfService

logger = logging.getLogger(__name__)


class PdfsController:
    def __init__(
        self,
        pdf_service: PdfService = Depends(),
        article_service: ArticleService = Depends(),
        collection_service: CollectionService = Depends(),
        job_service: JobService = Depends(),
    ):
        self.pdf_service = pdf_service
        self.article_service = article_service
        self.collection_service = collection_service
        self.job_service = job_service

    async def upload_pdf(
        self,
        pdf_data: PdfUpload,
        current_user: dict,
    ) -> StandardResponse:
        """
        Subir PDF, crear artículo placeholder y encolar su procesamiento.
        """
        user_id = current_user["_id"]
        collection_id = pdf_data.collection_id

        if collection_id:
            exists = await self.collection_service.collection_exists(user_id, collection_id)
            if not exists:
                return StandardResponse(
                    success=False,
                    message="Colección no encontrada",
                    data={},
                )

        pdf_id, absolute_path = await self.pdf_service.save_pdf(pdf_data, user_id)

        try:
            article_id = await self.article_service.create_processing_article(
                pdf_id=pdf_id,
                user_id=user_id,
                filename=pdf_data.filename,
                collection_id=collection_id,
            )
        except Exception as exc:
            logger.error(
                "Error creando artículo placeholder para PDF '%s': %s. Haciendo rollback...",
                pdf_data.filename,
                exc,
            )
            await self._rollback_saved_pdf(pdf_id=pdf_id, absolute_path=absolute_path)
            raise

        try:
            await self.job_service.enqueue_pdf_processing(
                pdf_id=pdf_id,
                article_id=article_id,
                user_id=user_id,
                absolute_path=absolute_path,
                filename=pdf_data.filename,
                collection_id=collection_id,
            )
        except Exception as exc:
            logger.error(
                "Error encolando procesamiento para PDF '%s': %s. Haciendo rollback...",
                pdf_data.filename,
                exc,
            )
            await self.article_service.force_delete(article_id)
            await self._rollback_saved_pdf(pdf_id=pdf_id, absolute_path=absolute_path)
            raise

        return StandardResponse(
            success=True,
            message="PDF recibido. Procesando en segundo plano...",
            data={
                "id_pdf": pdf_id,
                "article": {
                    "_id": article_id,
                    "title": pdf_data.filename,
                    "status": "processing",
                },
            },
        )

    async def _rollback_saved_pdf(self, pdf_id: str, absolute_path: str) -> None:
        try:
            await self.pdf_service.force_delete(pdf_id)
        except Exception as rollback_err:
            logger.warning("Rollback: error eliminando registro PDF: %s", rollback_err)

        try:
            pdf_path = Path(absolute_path)
            if pdf_path.exists():
                pdf_path.unlink()
        except Exception as rollback_err:
            logger.warning("Rollback: error eliminando archivo PDF: %s", rollback_err)
