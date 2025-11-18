"""
Servicio de OpenAlex.
"""
from datetime import datetime
from app.repositories import ArticleRepository
from app.models import QueryBody
from typing import List, Dict
import pyalex
from pyalex import config, Works, Authors, Sources, Institutions, Topics, Publishers, Funders
import json
from app.core import NotFoundError


class OpenAlexService:
    
    def __init__(self):
        pyalex.config.email = "nohovam893@mv6a.com"
        config.max_retries = 5
        config.retry_backoff_factor = 0.1
        config.retry_http_codes = [429, 500, 503]
    
    
    async def get_openalex_articles(self, body: QueryBody) -> Dict:
        limit = body.pagination.limit
        offset = body.pagination.offset
        filters = body.filters or {}

        # Calculate the page number from offset and limit
        page = (offset // limit) + 1 if limit > 0 else 1

        filters = filters or {}



        # Construimos y ejecutamos la query
        works_query = Works().filter(**filters)
        results = works_query.get(per_page=limit, page=page)

        # total de artículos que coinciden con la query
        total_articles = results.meta["count"]

        filtered_results = []

        for result in results:
            try:
                if result["primary_topic"] is not None:
                    result["category"] = result["primary_topic"]["display_name"]
                if result["publication_year"] is not None:
                    result["year"] = result["publication_year"]

                #Escoger solo 4 campos relevantes

                filtered_results.append({
                    "_id": result["id"],
                    "title": result["title"],
                    "year": result.get("year", ""),
                    "category": result.get("category", ""),
                    "pages": result.get("pages", ""),
                }) 
            except (KeyError, TypeError) as e:
                print("Error en el resultado:", e)
                print("Resultado problemático:", result)
                # with open("openalex_failed_results.json", "w", encoding="utf-8") as f:
                #     json.dump(result, f, ensure_ascii=False, indent=2)

        return {"articles": filtered_results, "total": total_articles}
    
    async def get_by_id(self, openalex_id: str) -> Dict:
        """
        Obtener artículo por ID.
        Verifica que el artículo pertenezca al usuario.
        """

        print("Buscando artículo de OpenAlex con ID:", openalex_id)
        article = Works().get(openalex_id)

        if isinstance(article, (tuple, list)):
            article = article[0]
        
        article = article[0]  # Acceder al primer elemento si es una lista o tupla
        print("TYPE OF ARTICLE RAW:", type(article) )
        if not article:
            raise NotFoundError("Artículo no encontrado")
        
        article = await self.select_fields(article)

        print("Artículo de OpenAlex obtenido:", article)
        return article



    async def select_fields(self, article: Dict) -> Dict:
        """
        Seleccionar solo los campos especificados de un artículo.
        """
        
        #print("TYPE OF ARTICLE:", type(article))
        #print("VALUE OF ARTICLE:", article)

        import json

        with open("resultado.json", "w", encoding="utf-8") as f:
            json.dump(article, f, indent=4, ensure_ascii=False)
                
        if article.get("primary_topic",None) is not None:
            article["category"] = article["primary_topic"]["display_name"]
        if article.get("publication_year",None) is not None:
            article["year"] = article["publication_year"]
        
        best_loc = None
        best_loc_is_oa_bool = False
        best_loc_pdf_bool = False
        best_loc_landing_bool = False

        #Bucle para conseguir la mejor localización -- Seguramente optimizable
        if article["locations"] is not None and len(article["locations"]) > 0:
            for loc in article["locations"]:
                is_oa_bool = False
                pdf_bool = False
                landing_bool = False
                if "is_oa" in loc and loc["is_oa"] is True:
                    is_oa_bool = True
                if "pdf_url" in loc and loc["pdf_url"] is not None:
                    pdf_bool = True
                if "landing_page_url" in loc and loc["landing_page_url"] is not None:
                    is_landing_bool = True

                #Si no es la primera localización
                if best_loc is None:
                    #Si no tiene ni pdf_url ni landing_page_url, seguimos con el None
                    if not pdf_bool and not landing_bool:
                        continue
                    #Si tiene alguna de las dos, la asignamos como mejor localización
                    else:
                        best_loc = loc
                        best_loc_is_oa_bool = is_oa_bool
                        best_loc_pdf_bool = pdf_bool
                        best_loc_landing_bool = landing_bool
                else:
                    #Si tenemos una loclización, la comparamos con la actual, siendo lo más importante la pdf_url
                    #luego la landing_page_url y por ultimo la is_oa
                    #Si dos locations tienen alguna url, se compara por is_oa
                    if best_loc_pdf_bool and pdf_bool:
                        if not best_loc_is_oa_bool and is_oa_bool:
                            best_loc = loc
                            best_loc_is_oa_bool = is_oa_bool
                            best_loc_pdf_bool = pdf_bool
                            best_loc_landing_bool = landing_bool
                    elif not best_loc_pdf_bool and pdf_bool:
                        best_loc = loc
                        best_loc_is_oa_bool = is_oa_bool
                        best_loc_pdf_bool = pdf_bool
                        best_loc_landing_bool = landing_bool
                    elif best_loc_landing_bool and landing_bool:
                        if not best_loc_is_oa_bool and is_oa_bool:
                            best_loc = loc
                            best_loc_is_oa_bool = is_oa_bool
                            best_loc_pdf_bool = pdf_bool
                            best_loc_landing_bool = landing_bool
                    elif not best_loc_landing_bool and landing_bool:
                        best_loc = loc
                        best_loc_is_oa_bool = is_oa_bool
                        best_loc_pdf_bool = pdf_bool
                        best_loc_landing_bool = landing_bool
        if best_loc is not None:
            article["pdf_url"] = best_loc["pdf_url"]
            article["landing_page_url"] = best_loc["landing_page_url"]

        keywords_list = []
        if "keywords" in article and article["keywords"] is not None and len(article["keywords"]) > 0:
            for key in article["keywords"]:
                if "score" in key and float(key["score"]) > 0.5 and "display_name" in key:
                    keywords_list.append({"key": key["display_name"], "score": key["score"]})
        article["keywords"] = keywords_list
       
        article_final = {
            "_id": article["id"],
            "doi": article.get("doi", ""),
            "title": article["title"],
            "relevance_score": article.get("relevance_score", None),
            "year": article.get("year", ""),
            "category": article.get("category", ""),
            "type": article.get("type", ""),
            "pages": article.get("pages", ""),
            "pdf_url": article.get("pdf_url", None),
            "landing_page_url": article.get("landing_page_url", None),
            "keywords": article.get("keywords", []),
            "referenced_works": article.get("referenced_works", []),
            "related_works": article.get("related_works", []),
            "counts_by_year": article.get("counts_by_year", []),
            "abstract": article["abstract"]
        }
            
        
        return article_final