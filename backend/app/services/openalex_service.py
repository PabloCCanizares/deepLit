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
        print("ENTRO EN SERVICE OPENALEX")
        limit = body.pagination.limit
        offset = body.pagination.offset
        filters = body.filters or {}

        # Calculate the page number from offset and limit
        page = (offset // limit) + 1 if limit > 0 else 1

        # Create the paginated query
        query = Works()["W2741809807"]

        # if filters:
        #     query = query.filter(**filters)

        # Get results from the paginator
        # openalex_articles = list(query)  # Convert Paginator to list to get results for the current page
        
        print("OPENALEX ARTICLES:", query)
        return {"articles": list(query)}