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
from app.services.article_service import normalize_article
import json

 
class OpenAlexService:
    
    def __init__(self):
        pyalex.config.email = "nohovam893@mv6a.com"
        config.max_retries = 5
        config.retry_backoff_factor = 0.1
        config.retry_http_codes = [429, 500, 503]
        self.article_repo = ArticleRepository()
        self.collection_repo = CollectionRepository() 

    def _normalize_year_value(self, value):
        """
        Normaliza un valor de año en formato int cuando sea posible.
        """
        if value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if len(stripped) >= 4 and stripped[:4].isdigit():
                return int(stripped[:4])
        return None

    def _get_current_year(self) -> int:
        return datetime.utcnow().year

    def _sanitize_year(self, value):
        year = self._normalize_year_value(value)
        if year is None:
            return None

        current_year = self._get_current_year()
        if 1000 <= year <= current_year:
            return year
        return None

    def _sanitize_counts_by_year(self, values: Any) -> List[Dict[str, int]]:
        if not isinstance(values, list):
            return []

        current_year = self._get_current_year()
        cleaned: List[Dict[str, int]] = []
        for item in values:
            if not isinstance(item, dict):
                continue

            year = self._sanitize_year(item.get("year"))
            if year is None or year > current_year:
                continue

            cited_by_count = item.get("cited_by_count")
            try:
                cited_by_count = int(cited_by_count) if cited_by_count is not None else 0
            except (TypeError, ValueError):
                cited_by_count = 0

            cleaned.append({
                "year": year,
                "cited_by_count": max(0, cited_by_count),
            })

        return cleaned

    def _extract_year(self, payload: Dict[str, Any]):
        """
        Extrae el año desde distintas variantes del esquema OpenAlex.
        """
        if not payload:
            return None

        direct_candidates = [
            payload.get("year"),
            payload.get("publication_year"),
            payload.get("from_publication_date"),
            payload.get("to_publication_date"),
            payload.get("publication_date"),
        ]

        biblio = payload.get("biblio") if isinstance(payload.get("biblio"), dict) else {}
        if biblio:
            direct_candidates.append(biblio.get("publication_year"))

        for candidate in direct_candidates:
            normalized = self._sanitize_year(candidate)
            if normalized is not None:
                return normalized

        return None

    def _extract_work_id(self, payload: Optional[Dict[str, Any]]) -> Optional[str]:
        """
        Extrae el identificador OpenAlex (W...) desde el payload.
        """
        raw_id = payload.get("id") if isinstance(payload, dict) else None
        if isinstance(raw_id, str) and raw_id.strip():
            return raw_id.rstrip("/").split("/")[-1]

        return None

    async def save_openalex_article_by_id(
        self,
        openalex_id: str,
        collection_id: Optional[str],
        id_user: str
    ) -> Dict:
        """
        Guardar artículo de OpenAlex por ID en una colección específica.
        Siempre añade a "Mis Artículos" (id_user) además de la colección especificada.
        """
        article = await self.get_by_id(openalex_id)

        article["id_user"] = id_user

        article_id = article.get("_id")
        if not article_id:
            raise NotFoundError("No se pudo resolver el ID del artículo de OpenAlex")
        article["_id"] = article_id

        # Si el artículo ya existe, añadirlo a las colecciones
        existing_article = await self.article_repo.find_by_id(article_id)
        if existing_article:
            # Siempre añadir a "Mis Artículos" (id_user)
            await self.collection_repo.add_article_to_collection(id_user, article_id)
            # Si hay colección específica, añadirlo también
            if collection_id:
                await self.collection_repo.add_article_to_collection(collection_id, article_id)
        # Si no existe, se crea uno nuevo
        else:
            if collection_id:
                # Añadir tanto a la colección específica como a "Mis Artículos" (id_user)
                article["collection_ids"] = [collection_id, id_user]
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
        Quitar artículo de una colección o eliminarlo completamente.
        - Si collection_id es None: quita de "Mis Artículos" (id_user)
        - Si el artículo queda sin colecciones: se elimina de la base de datos
        """
        article = await self.article_repo.find_by_id(openalex_id)
        if not article:
            raise NotFoundError("Artículo no encontrado")
        
        article_id = article["_id"]
        article_owner = article.get("id_user")
        
        if article_owner != id_user:
            raise AuthorizationError("No tienes permiso para modificar este artículo")

        article_collection_ids = article.get("collection_ids", [])
        
        # Determinar de qué colección quitar
        target_collection = collection_id if collection_id else id_user
        
        # Quitar de la colección especificada (o de "Mis Artículos" si no se especifica)
        if target_collection in article_collection_ids:
            await self.collection_repo.remove_article_from_collection(target_collection, article_id)
            article_collection_ids.remove(target_collection)
        
        # Si el artículo ya no pertenece a ninguna colección, eliminarlo completamente
        if len(article_collection_ids) == 0:
            result = await self.article_repo.delete(article_id)
        else:
            result = True

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

    def _has_search_filter(self, filters: Dict[str, Any]) -> bool:
        """
        Detecta si hay una búsqueda textual real para poder ordenar por relevancia.
        """
        return any(key == "search" or key.endswith(".search") for key in filters.keys())

    async def get_openalex_articles(self, body: QueryBody) -> Dict:
        limit = body.pagination.limit
        offset = body.pagination.offset
        page = (offset // limit) + 1 if limit > 0 else 1

        raw_filters = body.filters or {}

        # FIXME de momento no se usa el mode con OpenAlex
        mode_filter = raw_filters.pop("mode", None)
        
        filters = self.map_filters(raw_filters)
        filters["to_publication_date"] = datetime.utcnow().date().isoformat()
        works_query = Works()
        if filters:
            works_query = works_query.filter(**filters)


        if body.sort_by:
            try:
                sort_field, sort_order = body.sort_by.split("-")
            except ValueError:
                # Si llega algo inválido, usar orden asc por defecto
                sort_field = body.sort_by
                sort_order = "asc"
            

            sort_field = self.map_sort_field(sort_field)

            if sort_field in ["display_name", "cited_by_count", "works_count", "publication_date", "relevance_score"]:
                if sort_field == "relevance_score" and not self._has_search_filter(filters):
                    sort_field = None

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
                primary_topic = result.get("primary_topic")
                if isinstance(primary_topic, dict):
                    result["category"] = primary_topic.get("display_name")

                year_value = self._extract_year(result)
                raw_year_value = self._normalize_year_value(
                    result.get("year") or result.get("publication_year")
                )
                if raw_year_value is not None and raw_year_value > self._get_current_year():
                    continue
                if year_value is None and result.get("publication_date"):
                    continue

                #Escoger solo 4 campos relevantes

                filtered_results.append({
                    "_id": result["id"].split("/")[-1],
                    "title": result.get("title") or result.get("display_name") or "",
                    "year": year_value if year_value is not None else "No disponible",
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

        if isinstance(article, (tuple, list)) and len(article) > 0:
            article = article[0]
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
        work_id = self._extract_work_id(article)
        if not work_id:
            raise NotFoundError("Artículo de OpenAlex sin identificador")
        
        #print("TYPE OF ARTICLE:", type(article))
        #print("VALUE OF ARTICLE:", article)
        '''
        with open("resultado.json", "w", encoding="utf-8") as f:
            json.dump(article, f, indent=4, ensure_ascii=False)
        '''
        # Si tiene primary_topic, asignar category (es lo mismo)
        if article.get("primary_topic",None) is not None:
            article["category"] = article["primary_topic"]["display_name"]
        # Normalizar año con fallback robusto
        article["year"] = self._extract_year(article)
        article["counts_by_year"] = self._sanitize_counts_by_year(article.get("counts_by_year"))
        
        best_loc = None
        best_loc_is_oa_bool = False
        best_loc_pdf_bool = False
        best_loc_landing_bool = False

        #Bucle para conseguir la mejor localización -- Seguramente optimizable
        locations = article.get("locations") or []
        if len(locations) > 0:
            for loc in locations:
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
            "doi": article.get("doi", None),
            "title": article.get("title", None) or article.get("display_name", None),
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
            "abstract": article.get("abstract")
        }
        
        # Normalizar para asegurar que todos los campos estén presentes
        article_final = normalize_article(article_final)
        article_final["_id"] = work_id
        
        return article_final
