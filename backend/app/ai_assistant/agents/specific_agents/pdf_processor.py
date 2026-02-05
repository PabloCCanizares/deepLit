from langchain_community.document_loaders.pdf import PyMuPDFLoader
from langchain_community.document_loaders.parsers import RapidOCRBlobParser
from typing import List, Optional
from pathlib import Path
from pydantic import BaseModel, Field
from ..base_agents.rag_agent import RagAgent
from ..prompts import PDF_PROCESSOR_PROMPT
from ..config import PDF_PROCESSOR_CONFIG

class Metadata(BaseModel):
    doi: Optional[str] = Field(None, description="DOI del documento si se encuentra.")
    title: str = Field(..., description="Título principal del documento.")
    year: int = Field(..., description="Año de publicación. Si no está explícito, estima")
    category: str = Field(..., description="Categoría temática del documento (ej: Ciencia, Tecnología, Medicina).")
    type: str = Field(..., description="Tipo de documento (Paper, Tesis, Artículo, Reporte).")
    keywords: List[str] = Field(default_factory=list, description="Lista de palabras clave (Keywords).")
    referenced_works: List[str] = Field(default_factory=list, description="Lista de obras/autores citados en la bibliografía.")
    abstract: str = Field(None, description="El Abstract o Resumen original del texto.")
    authors: List[str] = Field(default_factory=list, description="Lista de nombres de los autores.")
    citations: Optional[int] = Field(None, description="Número total de citas si se menciona en el documento.")
    summary: str = Field(None, description="Un resumen generado del contenido.")

agent = RagAgent(**PDF_PROCESSOR_CONFIG, system_prompt=PDF_PROCESSOR_PROMPT)
agent.set_structured_output(Metadata) #importante para que la salida sea json

def process_pdf(file_path):
    # RAG
    docs = load_document(file_path=file_path)
    number_pages = len(docs)
    embbedings = agent.process_documents(docs=docs)
    if number_pages > 5:
        docs = docs[:3] + docs[-2:]
    pdf_text = "\nEl texto del pdf es: ".join([d.page_content for d in docs])
    prompt = agent.create_prompt(message=pdf_text)
    output = agent.invoke(prompt, structured_output=True)
    output["pages"] = number_pages
    agent.print_agent_execution(agent="PDF PROCESSOR", input=prompt, output=output)

    return {'metadata': output, 'embbedings': embbedings}

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
