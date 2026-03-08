from langchain_community.document_loaders.pdf import PyMuPDFLoader
from langchain_community.document_loaders.parsers import RapidOCRBlobParser
import re
from typing import List, Optional
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from ..base_agents.rag_agent import RagAgent
from ..prompts import PDF_PROCESSOR_PROMPT
from ..config import get_pdf_processor_config


class Metadata(BaseModel):
    doi: Optional[str] = Field(None, description="DOI del documento si se encuentra.")
    title: str = Field(..., description="Titulo principal del documento.")
    year: int = Field(..., description="Ano de publicacion. Si no esta explicito, estima")
    category: str = Field(..., description="Categoria tematica del documento (ej: Ciencia, Tecnologia, Medicina).")
    type: str = Field(..., description="Tipo de documento (Paper, Tesis, Articulo, Reporte).")
    keywords: List[str] = Field(default_factory=list, description="Lista de palabras clave (Keywords).")
    authors: List[str] = Field(default_factory=list, description="Lista de autores del documento.")
    referenced_works: List[str] = Field(default_factory=list, description="Lista de referencias bibliograficas completas (texto).")
    abstract: str = Field(None, description="El Abstract o Resumen original del texto.")

    @field_validator("referenced_works", mode="before")
    @classmethod
    def normalize_referenced_works(cls, value):
        if value is None:
            return []
        if not isinstance(value, list):
            value = [value]

        cleaned = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if not text:
                continue
            if text.isdigit() or re.fullmatch(r"\[\d+\]", text):
                continue
            cleaned.append(text)
        return cleaned


def _remove_references_section(text: str) -> str:
    """
    Elimina la seccion de referencias para que el LLM no derive titulo/tipo de la bibliografia.
    """
    if not text:
        return text

    pattern = re.compile(r"(?im)^\s*(references|bibliography|bibliografia)\s*$")
    match = pattern.search(text)
    if match:
        return text[:match.start()].strip()
    return text


def process_pdf(file_path, article_id=None, user_id=None, offline=None):
    config = get_pdf_processor_config(offline)
    agent = RagAgent(**config, system_prompt=PDF_PROCESSOR_PROMPT)
    agent.set_structured_output(Metadata)

    # RAG
    docs = load_document(file_path=file_path)
    number_pages = len(docs)
    agent.process_documents(docs=docs)

    # Persistir FAISS index a disco (por user_id/article_id)
    if article_id and user_id:
        faiss_index_path = str(Path(__file__).resolve().parents[4] / "storage" / "faiss_indexes" / str(user_id) / article_id)
        agent.save_index(faiss_index_path)

    # Para metadatos principales usar primeras paginas y sin seccion de referencias
    first_pages_text = "\n".join([d.page_content for d in docs[: min(5, len(docs))]])
    metadata_text = _remove_references_section(first_pages_text) or first_pages_text

    prompt = agent.create_prompt(message=f"Texto para metadatos principales:\n{metadata_text}")
    output = agent.invoke(prompt, structured_output=True)
    output["pages"] = number_pages

    agent.print_agent_execution(agent="PDF PROCESSOR", input=prompt, output=output)
    return {"docs": docs, "metadata": output}


def load_document(file_path):
    file_path = Path(file_path)
    loader = PyMuPDFLoader(
        str(file_path),
        mode="page",
        images_inner_format="markdown-img",
        images_parser=RapidOCRBlobParser(),
        extract_tables="markdown",
    )
    docs = loader.load()

    return docs
