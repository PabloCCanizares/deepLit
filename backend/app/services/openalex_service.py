"""
Servicio de OpenAlex.
"""
from datetime import datetime
from app.models import QueryBody
from typing import List, Dict, Any, Optional
import pyalex
from pyalex import config, Works, Authors, Sources, Institutions, Topics, Publishers, Funders
from app.core import NotFoundError
from app.repositories import ArticleRepository
from app.repositories import CollectionRepository
from app.core import NotFoundError, AuthorizationError
import json

 
class OpenAlexService:
    
    def __init__(self):
        pyalex.config.email = "nohovam893@mv6a.com"
        config.max_retries = 5
        config.retry_backoff_factor = 0.1
        config.retry_http_codes = [429, 500, 503]
        self.article_repo = ArticleRepository()
        self.collection_repo = CollectionRepository() 

    async def save_openalex_article_by_id(
        self,
        openalex_id: str,
        collection_id: Optional[str],
        id_user: str
    ) -> Dict:
        """
        Guardar artículo de OpenAlex por ID en una colección específica.
        """
        article = await self.get_by_id(openalex_id)

        article["id_user"] = id_user

        article_id = article["_id"]

        # Si el artículo ya existe, solo se añade a la colección (si se proporciona)
        if await self.article_repo.find_by_id(article_id):
            if collection_id:
                await self.collection_repo.add_article_to_collection(collection_id, article_id)
        # Si no existe, se crea uno nuevo
        else:
            if collection_id:
                article["collection_ids"] = [collection_id]
            else:
                article["collection_ids"] = [id_user]
            # Se guarda el artículo en la base de datos
            article_id = await self.article_repo.create(article)

        return article_id


    async def unsave_openalex_article_by_id(
        self,
        openalex_id: str,
        collection_id: Optional[str],
        id_user: str
    ) -> Dict:
        """
        
        """
        article = await self.article_repo.find_by_id(openalex_id)
        article_id = article["_id"]
        article_id_user = article["id_user"]
        if not article:
            raise NotFoundError("Artículo no encontrado")
        if article_id_user != id_user:
            raise AuthorizationError("No tienes permiso para modificar este artículo")

        
        article_collection_ids = article.get("collection_ids", [])
        
        # Casuística compleja: FIXME explicacion
        if article_id_user in article_collection_ids and collection_id is None:
            elim = await self.collection_repo.remove_article_from_collection(article_id_user, article_id)
            if elim:
                article_collection_ids.remove(article_id_user)

        if len(article_collection_ids) > 1 :
            result = await self.collection_repo.remove_article_from_collection(collection_id, article_id)
        else:
            result = await self.article_repo.delete(article_id)


        return result
        

    
    def map_sort_field(self, field: str) -> str:
        field_mappings = {
            "year": "publication_date",
            "title": "display_name",
            "relevance": "relevance_score",
            "works_count": "works_count",
            "cited_by_count": "cited_by_count",
        }
        return field_mappings.get(field, field)  # Devuelve el campo mapeado o el original si no hay mapeo


    def map_filters(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        mapped = {}
        
        for key, value in filters.items():
            if value is None or value == "":
                continue  # ignorar filtros vacíos

            # FIXME Otros filtros :
            if key == "year":
                mapped["publication_year"] = value
                continue

            # Si es un filtro válido, pasarlo tal cual
            mapped[key] = value

        return mapped


    async def get_openalex_articles(self, body: QueryBody) -> Dict:
        limit = body.pagination.limit
        offset = body.pagination.offset
        page = (offset // limit) + 1 if limit > 0 else 1

        raw_filters = body.filters or {}

        # FIXME de momento no se usa el mode con OpenAlex
        mode_filter = raw_filters.pop("mode", None)
        
        filters = self.map_filters(raw_filters)

        works_query = Works().filter(**filters)


        if body.sort_by:
            try:
                sort_field, sort_order = body.sort_by.split("-")
            except ValueError:
                # Si llega algo inválido, usar orden asc por defecto
                sort_field = body.sort_by
                sort_order = "asc"
            

            sort_field = self.map_sort_field(sort_field)

            if sort_field in ["display_name", "cited_by_count", "works_count", "publication_date", "relevance_score"]:
                if sort_field=="cited_by_count":
                    works_query = works_query.sort(cited_by_count=sort_order)
                elif sort_field=="display_name":
                    works_query = works_query.sort(display_name=sort_order)
                elif sort_field=="works_count":
                    works_query = works_query.sort(works_count=sort_order)
                elif sort_field=="publication_date":
                    works_query = works_query.sort(publication_date=sort_order)
                elif sort_field=="relevance_score":
                    works_query = works_query.sort(relevance_score=sort_order)
            else:
                # Campo no soportado, ignorar ordenamiento
                pass

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
                    "_id": result["id"].split("/")[-1],
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
        # print("LONGITUD FILTRADOS:", len(filtered_results))
        # print("results", filtered_results[0])
        return {"articles": filtered_results, "total": total_articles}


    async def get_by_id(self, openalex_id: str) -> Dict:
        """
        Obtener artículo por ID.
        Verifica que el artículo pertenezca al usuario.
        """


        # print("Buscando artículo de OpenAlex con ID:", openalex_id)
        article = Works()[openalex_id]

        if isinstance(article, (tuple, list)):
            article = article[0]
            article = article[0]  # Acceder al primer elemento si es una lista o tupla
        # print("TYPE OF ARTICLE RAW:", type(article) )
        if not article:
            raise NotFoundError("Artículo no encontrado")
        
        article = await self.select_fields(article)

        # print("Artículo de OpenAlex obtenido:", article)
        return article



    async def select_fields(self, article: Dict) -> Dict:
        """
        Seleccionar solo los campos especificados de un artículo.
        """
        
        #print("TYPE OF ARTICLE:", type(article))
        #print("VALUE OF ARTICLE:", article)
        '''
        with open("resultado.json", "w", encoding="utf-8") as f:
            json.dump(article, f, indent=4, ensure_ascii=False)
        '''
        # Si tiene primary_topic, asignar category (es lo mismo)
        if article.get("primary_topic",None) is not None:
            article["category"] = article["primary_topic"]["display_name"]
        # Se hace lo mismo con publication-year -> year
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
                    landing_bool = True

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
            "_id": article.get("id", None).split("/")[-1],
            "doi": article.get("doi", None),
            "title": article.get("title", None),
            "relevance_score": article.get("relevance_score", None),
            "year": article.get("year", None),
            "category": article.get("category", None),
            "type": article.get("type", None),
            "pages": article.get("pages", None),
            "pdf_url": article.get("pdf_url", None),
            "landing_page_url": article.get("landing_page_url", None),
            "keywords": article.get("keywords", []),
            "referenced_works": article.get("referenced_works", []),
            "related_works": article.get("related_works", []),
            "counts_by_year": article.get("counts_by_year", []),
            "abstract": article["abstract"]
        }
            
        
        return article_final