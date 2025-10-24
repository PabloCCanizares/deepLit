"""
Servicio de OpenAlex.
"""
from datetime import datetime
from app.repositories import ArticleRepository
from app.models import QueryBody
from typing import List, Dict
import pyalex
from pyalex import config, Works, Authors, Sources, Institutions, Topics, Publishers, Funders


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

        filters["title.search"] = "chatgpt"

        # Construimos y ejecutamos la query
        works_query = Works().filter(**filters)
        results = works_query.get(per_page=limit, page=page)
        
        for result in results:
            print(result["primary_topic"]["display_name"])
            result["category"] = result["primary_topic"]["display_name"]
            result["year"] = result["publication_year"]
        return {"articles": results}
