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
        
          # extract_abstract(text)
        
        
        

        doi = "extract_doi"
        title = "extract_title"  
        relevance_score = "extract_relevance_score"  
        year = "extract_year"  
        category = "extract_category"  
        type_ = "extract_type"  
        pages = "extract_pages"
        pdf_url = "extract_pdf_url"  
        landing_page_url = "extract_landing_page_url"  
        keywords = [{"key": "Construct (python library)", "score": 0.8385770320892334}]
        referenced_works = ["https://openalex.org/W1560783210", "https://openalex.org/W1560783210"]
        related_works = ["https://openalex.org/W3203790917", "https://openalex.org/W3201736257"]
        counts_by_year = [{"year": 2025,"cited_by_count": 82},{"year": 2024,"cited_by_count": 118}]
        abstract = "extract_abstract"
        #FIXME: seguramente en la funcion de extract_text se pueden obtener las paginas
        
        return {
            "doi": doi,
            "title": title,
            "relevance_score": relevance_score,
            "year": year,
            "category": category,
            "type": type_,
            "pages": pages,
            "pdf_url": pdf_url,
            "landing_page_url": landing_page_url,
            "keywords": keywords,
            "referenced_works": referenced_works,
            "related_works": related_works,
            "counts_by_year": counts_by_year,
            "abstract": abstract
        }
    
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

