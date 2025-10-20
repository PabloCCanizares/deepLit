import os
import io
import base64
import PyPDF2
from datetime import datetime
from app.core import AuthenticationError, ConflictError
from app.repositories import ArticleRepository
from app.models import ArticlesQuery
from typing import List



class ArticleService:
    
    def __init__(self):
        self.article_repo = ArticleRepository()
    
    
    # No se si despues de sacar las características se guarda desde aqui o desde upload_service

    async def get_article_count(self, current_user: dict) -> dict:
        """
        Recuperar estadísticas del dashboard para el usuario actual.
        """
        #Cuantos artíclos tienen id de este usuario
        article_count = await self.article_repo.count_documents(current_user.get('_id')) #FIXME ¿Pasar todo el user o solo el id?
        # 3. Devolver info del usuario (sin password)
        return article_count
        
    async def extract_pdf_features(self, pdf_bytes: bytes) -> dict:
        """
        Extraer características de un PDF dado sus bytes.
        Args:
            pdf_bytes (bytes): Contenido binario del PDF.
        Returns:
            dict: Características extraídas del PDF.
        """
        text = await self.extract_text_from_pdf_bytes(pdf_bytes)
        
        #FIXME REFACTORIZAR ESTO EN FUNCIONES MÁS PEQUEÑAS O EN OTRO SERVICIO
        # 
        # FIXME MEJORAR LAS FUNCIONES DE EXTRACCIÓN         

        title = "extract_title" #await self.extract_title(text)
        abstract = "extract_abstract" #extract_abstract(text)
        keywords = "extract_keywords" #extract_keywords(text)
        bibliography = "extract_bibliography" #extract_bibliography(text)
        citations = "extract_citations" #extract_citations(text)

        year = "extract_year" #extract_year(text)
        category = "extract_category" #extract_category(text)
        pages = "extract_pages" #extract_pages(text) FIXME seguramente en la funcion de extract_text se pueden obtener las paginas
        """
        category = "" #extract_category(text)
        type = ""#extract_type(text)
        acronym = ""#extract_acronym(text)
        pages = ""#extract_pages(text)  
        obs = ""#extract_obs(text)
        summary = ""#extract_summary(text)
        link = ""#extract_link(text)
        quote = ""#extract_quote(text)
        authors = "" #extract_authors(text)
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
        "authors": autores,
        "Year": anio,             # Usamos "Year" para mantener la consistencia con home.html
        "Category": categoria,
        "Type": tipo,
        "Acronym": acronimo,
        "Cites": "",              # Ajusta según necesites
        "Pag.": paginas,
        "Obs.": obs,
        "Summary": resumen,
        "link": enlace,
        "citation": cita
    """
        

        
    async def extract_text_from_pdf_bytes(self, pdf_bytes: bytes) -> str:
        """
        Extrae el texto de un archivo PDF a partir de su contenido en bytes.

        Args:
            pdf_bytes (bytes): Contenido binario del PDF.

        Returns:
            str: Texto extraído del PDF.
        """
        full_text = ""
        with io.BytesIO(pdf_bytes) as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
        return full_text
    

    async def get_user_articles(self, query: ArticlesQuery,current_user: dict) -> List[dict]:
        """
        Recuperar artículos del usuario actual.
        """
        # Lógica para obtener los artículos del usuario desde la base de datos
        # Aplicar paginación y filtros según los parámetros en 'query'
        articles = await self.article_repo.get_user_articles(query, current_user)
        return articles

    

