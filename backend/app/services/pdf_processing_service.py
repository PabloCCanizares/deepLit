"""
Servicio de procesamiento inteligente de PDFs.
"""
import re
from pathlib import Path
from typing import Optional

from langchain_community.document_loaders.parsers import RapidOCRBlobParser
from langchain_community.document_loaders.pdf import PyMuPDFLoader

from app.ai_assistant.agents.base_agents.base_agent import BaseAgent
from app.ai_assistant.config import (
    DEFAULT_TEXT_SPLITTER,
    get_embeddings,
    get_model_name,
)
from app.config import settings
from app.models import PdfMetadata
from app.services.storage_service import StorageService
from app.services.vector_index_service import VectorIndexService


PDF_PROCESSOR_PROMPT = """
Eres un analista de documentos cientificos experto en extraccion de metadatos.
Extrae DOI, titulo, autores, ano, categoria, tipo, keywords, abstract y referencias.
Para referencias devuelve la cita bibliografica completa en texto, sin indices numericos tipo [38].
No uses la seccion de referencias para inferir titulo o tipo del documento.
Si falta un dato, usa "No disponible".
""".strip()


def _remove_references_section(text: str) -> str:
    if not text:
        return text

    pattern = re.compile(r"(?im)^\s*(references|bibliography|bibliografia)\s*$")
    match = pattern.search(text)
    if match:
        return text[:match.start()].strip()
    return text


def _build_pdf_processing_config(offline: Optional[bool] = None) -> dict:
    if offline is None:
        offline = settings.OFFLINE
    return {
        "modelo": get_model_name(offline),
        "temperatura": 0,
        "text_splitter": DEFAULT_TEXT_SPLITTER,
        "embedding_model": get_embeddings(offline),
        "offline": offline,
    }


class PdfProcessingService:
    def __init__(self):
        self.storage_service = StorageService()

    def process_pdf(
        self,
        file_path: str,
        article_id: Optional[str] = None,
        user_id: Optional[str] = None,
        offline: Optional[bool] = None,
    ) -> dict:
        config = _build_pdf_processing_config(offline)
        agent = BaseAgent(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt=PDF_PROCESSOR_PROMPT,
        )
        vector_index_service = VectorIndexService(
            embedding_model=config["embedding_model"],
            text_splitter=config["text_splitter"],
        )
        agent.set_structured_output(PdfMetadata)

        docs = self.load_document(file_path=file_path)
        number_pages = len(docs)

        first_pages_text = "\n".join([d.page_content for d in docs[: min(5, len(docs))]])
        metadata_text = _remove_references_section(first_pages_text) or first_pages_text

        prompt = agent.create_prompt(message=f"Texto para metadatos principales:\n{metadata_text}")
        output = agent.invoke(prompt, structured_output=True)
        output["pages"] = number_pages

        article_title = output.get("title") or article_id or self._get_file_stem(file_path)
        for doc in docs:
            metadata = doc.metadata or {}
            if article_id:
                metadata["article_id"] = article_id
                metadata["source"] = f"article:{article_id}"
            metadata["article_title"] = article_title
            doc.metadata = metadata

        vector_store = vector_index_service.index_documents(docs=docs)

        if article_id and user_id:
            faiss_index_path = self.storage_service.get_faiss_article_dir(user_id=user_id, article_id=article_id)
            vector_index_service.save_index(vector_store=vector_store, save_path=str(faiss_index_path))

        agent.print_agent_execution(agent="PDF PROCESSOR", input=prompt, output=output)
        return {"docs": docs, "metadata": output}

    def load_document(self, file_path: str):
        loader = PyMuPDFLoader(
            str(file_path),
            mode="page",
            images_inner_format="markdown-img",
            images_parser=RapidOCRBlobParser(),
            extract_tables="markdown",
        )
        return loader.load()

    def _get_file_stem(self, file_path: str) -> str:
        return Path(file_path).stem
