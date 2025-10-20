from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class Pagination(BaseModel):
    limit: int 
    offset: int

class ArticlesQuery(BaseModel):
    pagination: Pagination
    filters: Optional[Dict[str, Any]] = None