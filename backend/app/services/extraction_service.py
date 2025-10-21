"""
Servicio de extracción de características de PDFs.

Responsabilidad: SOLO extraer información de PDFs (título, autores, etc.)
"""
import io
import PyPDF2
from typing import Dict


class ExtractionService:
    
    async def extract_features(self, pdf_bytes: bytes) -> Dict:
        """
        Extraer características de un PDF dado sus bytes.
        """
        # Extraer texto del PDF
        text = await self.extract_text_from_pdf_bytes(pdf_bytes)
        
        # FIXME: MEJORAR LAS FUNCIONES DE EXTRACCIÓN
        # Por ahora devuelven placeholders, implementar lógica real
        
        title = "extract_title"  # await self.extract_title(text)
        abstract = "extract_abstract"  # extract_abstract(text)
        keywords = "extract_keywords"  # extract_keywords(text)
        bibliography = "extract_bibliography"  # extract_bibliography(text)
        citations = "extract_citations"  # extract_citations(text)
        year = "extract_year"  # extract_year(text)
        category = "extract_category"  # extract_category(text)
        pages = "extract_pages"  # extract_pages(text) 
        # FIXME: seguramente en la funcion de extract_text se pueden obtener las paginas
        
        """
        # TODO: Implementar estas extracciones adicionales
        category = ""  # extract_category(text)
        type = ""  # extract_type(text)
        acronym = ""  # extract_acronym(text)
        pages = ""  # extract_pages(text)  
        obs = ""  # extract_obs(text)
        summary = ""  # extract_summary(text)
        link = ""  # extract_link(text)
        quote = ""  # extract_quote(text)
        authors = ""  # extract_authors(text)
        """
        
        return {
            "title": title,
            "abstract": abstract,
            "keywords": keywords,
            "bibliography": bibliography,
            "citations": citations,
            "year": year,
            "category": category,
            "pages": pages
        }
    
    """
    # Formato esperado para mantener consistencia con home.html
    {
        "authors": autores,
        "Year": anio,
        "Category": categoria,
        "Type": tipo,
        "Acronym": acronimo,
        "Cites": "",
        "Pag.": paginas,
        "Obs.": obs,
        "Summary": resumen,
        "link": enlace,
        "citation": cita
    }
    """
    
    async def extract_text_from_pdf_bytes(self, pdf_bytes: bytes) -> str:
        """
        Extrae el texto de un archivo PDF a partir de su contenido en bytes.
        """
        full_text = ""
        with io.BytesIO(pdf_bytes) as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
        return full_text

