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

        for result in results:
            try:
                if result["primary_topic"] is not None:
                    result["category"] = result["primary_topic"]["display_name"]
                if result["publication_year"] is not None:
                    result["year"] = result["publication_year"]
            except (KeyError, TypeError) as e:
                print("Error en el resultado:", e)
                print("Resultado problemático:", result)
                # with open("openalex_failed_results.json", "w", encoding="utf-8") as f:
                #     json.dump(result, f, ensure_ascii=False, indent=2)

        return {"articles": results, "total": total_articles}
