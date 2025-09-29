import pyalex
from pyalex import config, Works, Authors, Sources, Institutions, Topics, Publishers, Funders

class AlexSearch:
    def __init__(self):
        pyalex.config.email = "nohovam893@mv6a.com"
        config.max_retries = 0
        config.retry_backoff_factor = 0.1
        config.retry_http_codes = [429, 500, 503]
    
    def search_query(self, query):
        documents = Works().search(query).get()
        return documents
    
    def search_query_filtered(self, query):
        documents = Works().search_filter(**query).get()
        return documents[1]


query = {
        "title": "animal",
        "abstract": "climate",
        }
a = AlexSearch()
print(a.search_query_filtered(query))
