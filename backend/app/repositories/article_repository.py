"""
Repositorio de artículos.
"""
from typing import Dict, List, Optional
from app.database import get_database
from app.models import QueryBody
from pymongo import ASCENDING, DESCENDING

class ArticleRepository:
    
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.articles
    
    async def create(self, article_data: dict) -> str:
        """Crear un nuevo artí­culo"""
        result = await self.collection.insert_one(article_data)
        # Si usamos _id personalizado, inserted_id serí¡ ese _id
        # Si MongoDB genera el _id, usamos result.inserted_id
        return article_data.get("_id") or str(result.inserted_id)
    
    async def find_by_id(self, article_id: str) -> Optional[dict]:
        """Buscar artí­culo por ID"""
        article = await self.collection.find_one({"_id": article_id})
        return article
    
    async def update(self, article_id: str, update_data: dict) -> Optional[dict]:
        """Actualizar artí­culo por ID"""
        result = await self.collection.update_one(
            {"_id": article_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return None
        
        # Devolver el artí­culo actualizado
        return await self.find_by_id(article_id)
    
    async def delete(self, article_id: str) -> bool:
        """Eliminar artí­culo por ID"""
        result = await self.collection.delete_one({"_id": article_id})
        return result.deleted_count > 0
    
    async def count_documents(self, user_id: str, collection_id: Optional[str] = None) -> int:
        """Contar documentos asociados a un usuario (excluyendo processing/error)"""

        filter_query = {
            "id_user": user_id,
            "status": {"$nin": ["processing", "error"]}
        }
        
        if collection_id:  # Si collection no es None ni vací­o
            filter_query["collection_ids"] = {"$in": [collection_id]}
        
        count = await self.collection.count_documents(filter_query)

        return count
    
    async def count_documents_by_year(self, user_id: str, collection_id: Optional[str] = None) -> List[dict]:
        """Contar artí­culos agrupados por aí±o para un usuario"""
        # Filtro base
        match_filter = {"id_user": user_id}

        # Si se especifica collection_id y collection_ids es un array en los documentos
        if collection_id:
            match_filter["collection_ids"] = {"$in": [collection_id]}

        # Pipeline de agregación
        pipeline = [
            {"$match": match_filter},
            {"$group": {"_id": "$year", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]

        # Ejecutar agregación
        cursor = self.collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        return results
        

    async def get_processing_articles(self, user_id: str) -> List[dict]:
        """Obtener artí­culos en cola (status processing o error) del usuario."""
        cursor = self.collection.find(
            {
                "id_user": user_id,
                "status": {"$in": ["processing", "error"]}
            }
        ).sort("created_at", DESCENDING)
        return await cursor.to_list(length=None)

    async def get_scope_article_ids(self, user_id: str, collection_id: Optional[str] = None) -> List[str]:
        """
        Obtener IDs de artículos accesibles para un usuario y alcance opcional de colección.
        """
        filter_query = {"id_user": user_id}
        if collection_id:
            filter_query["collection_ids"] = {"$in": [collection_id]}

        cursor = self.collection.find(filter_query, {"_id": 1})
        docs = await cursor.to_list(length=None)
        return [str(doc["_id"]) for doc in docs if doc.get("_id") is not None]

    async def get_titles_by_ids(self, article_ids: List[str]) -> Dict[str, str]:
        """
        Obtener un mapa article_id -> title para una lista de artículos.
        """
        if not article_ids:
            return {}

        cursor = self.collection.find(
            {"_id": {"$in": list(article_ids)}},
            {"_id": 1, "title": 1},
        )
        docs = await cursor.to_list(length=None)
        return {
            str(doc["_id"]): doc.get("title") or str(doc["_id"])
            for doc in docs
            if doc.get("_id") is not None
        }

    async def get_articles_for_metadata_index(self, user_id: str, collection_id: Optional[str] = None) -> List[dict]:
        """
        Obtener los artículos de un usuario/colección para construir el índice de metadatos.
        """
        filter_query = {"id_user": user_id}
        if collection_id:
            filter_query["collection_ids"] = {"$in": [collection_id]}

        cursor = self.collection.find(filter_query).sort("_id", ASCENDING)
        return await cursor.to_list(length=None)

    async def get_user_articles(self, query: QueryBody, user_id: str, collection_id: Optional[str] = None) -> List[dict]:
        """Recuperar artí­culos del usuario actual con paginación y filtros"""
        
        filter_criteria = {"id_user": user_id}

        # Excluir artí­culos en procesamiento o con error de la lista normal
        filter_criteria["status"] = {"$nin": ["processing", "error"]}

        if collection_id:
            filter_criteria["collection_ids"] = {"$in": [collection_id]}

        limit = query.pagination.limit
        offset = query.pagination.offset

        sort_criteria = query.sort_by

        filters = query.filters or {}

        # Extraer filtros especiales antes de procesar los genéricos
        mode_filter = filters.pop("mode", None)
        year_min = filters.pop("year_min", None)
        year_max = filters.pop("year_max", None)
        author_filter = filters.pop("author", None)
        keyword_filter = filters.pop("keyword", None)

        # Filtros genéricos: strings se convierten a regex case-insensitive
        if filters:
            for key, value in filters.items():
                if isinstance(value, str) and key not in ["mode"]:
                    filter_criteria[key] = {"$regex": value, "$options": "i"}
                else:
                    filter_criteria[key] = value

        # Filtro de rango de año
        if year_min or year_max:
            year_cond = {}
            if year_min:
                try:
                    year_cond["$gte"] = int(year_min)
                except (ValueError, TypeError):
                    pass
            if year_max:
                try:
                    year_cond["$lte"] = int(year_max)
                except (ValueError, TypeError):
                    pass
            if year_cond:
                filter_criteria["year"] = year_cond

        # Filtro de autor (búsqueda regex en el campo authors)
        if author_filter and isinstance(author_filter, str):
            filter_criteria["authors"] = {"$regex": author_filter, "$options": "i"}

        # Filtro de palabra clave (búsqueda en keywords[].key)
        if keyword_filter and isinstance(keyword_filter, str):
            filter_criteria["keywords"] = {"$elemMatch": {"key": {"$regex": keyword_filter, "$options": "i"}}}

        # Filtro de completitud
        if mode_filter == "complete":
            filter_criteria.setdefault("title", {"$ne": None})
            filter_criteria.setdefault("year", {"$ne": None})
            filter_criteria.setdefault("pages", {"$ne": None})
            filter_criteria.setdefault("category", {"$ne": None})
        elif mode_filter == "incomplete":
            filter_criteria["$or"] = [
                {"title": None},
                {"year": None},
                {"pages": None},
                {"category": None}
            ]

        # Proyección: campos necesarios para la lista
        projection = {
            "_id": 1,
            "title": 1,
            "category": 1,
            "type": 1,
            "pages": 1,
            "year": 1,
            "authors": 1,
            "keywords": 1,
            "status": 1
        }

        # Aplicar ordenación
        cursor = self.collection.find(filter_criteria, projection)

        sort_map = {
            "year-asc": ("year", ASCENDING),
            "year-desc": ("year", DESCENDING),
            "title-asc": ("title", ASCENDING),
            "title-desc": ("title", DESCENDING),
        }

        if sort_criteria in sort_map:
            field, direction = sort_map[sort_criteria]
            cursor = cursor.sort(field, direction)

        # Aplicar paginación despuí©s del sort
        cursor = (
            cursor
            .skip(offset)
            .limit(limit)
        )


        results = await cursor.to_list(length=limit)
        # print("RESULTS:", results)
        return results




    async def get_keywords_aggregated(self, user_id: str, collection_id: Optional[str] = None) -> List[dict]:
        """
        Obtener keywords agrupadas y contadas para un usuario.
        Devuelve lista de {keyword, count} ordenada por count descendente.
        """
        # Filtro base
        match_filter = {"id_user": user_id}

        # Si se especifica collection_id
        if collection_id:
            match_filter["collection_ids"] = {"$in": [collection_id]}

        # Pipeline de agregación
        # keywords es un array de objetos {key: string, score: number}
        pipeline = [
            {"$match": match_filter},
            {"$unwind": "$keywords"},  # Descomponer el array de keywords
            {"$group": {
                "_id": "$keywords.key",  # Agrupar por el campo 'key' del keyword
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},  # Ordenar por count descendente
            {"$limit": 50}  # Limitar a las 50 mí¡s frecuentes
        ]

        cursor = self.collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        return results

    async def get_article_ids_by_collection(self, collection_id: str) -> List[str]:
        """
        Devuelve una lista de IDs de artí­culos que pertenecen a una colección.
        Busca por artí­culos donde 'collection_ids' contiene el collection_id.
        """

        cursor = self.collection.find(
            {"collection_ids": collection_id},
            {"_id": 1}  # Solo devolver el ID
        )

        ids = []
        async for doc in cursor:
            ids.append(str(doc["_id"]))

        # print("Article IDs in collection", collection_id, ":", ids)
        return ids
    async def get_dashboard_fields(self, user_id: str, collection_id: Optional[str] = None) -> List[dict]:
        """
        Obtener campos minimos para construir estadisticas del dashboard.
        Excluye articulos en processing/error.
        """
        filter_query = {
            "id_user": user_id,
            "status": {"$nin": ["processing", "error"]}
        }

        if collection_id:
            filter_query["collection_ids"] = {"$in": [collection_id]}

        projection = {
            "_id": 0,
            "year": 1,
            "keywords": 1,
            "type": 1,
            "category": 1,
            "authors": 1
        }

        cursor = self.collection.find(filter_query, projection)
        return await cursor.to_list(length=None)

    async def find_all_for_article_graph_sync(self) -> List[dict]:
        """
        Devuelve todos los artículos que deben existir en Neo4j:
        tienen ``id_user`` y no están en processing/error (misma regla que el dashboard).

        Se usa al arrancar el servidor para sincronizar Mongo → Neo4j.
        """
        filter_query = {
            "id_user": {"$exists": True, "$nin": [None, ""]},
            "status": {"$nin": ["processing", "error"]},
        }
        cursor = self.collection.find(filter_query).sort("_id", ASCENDING)
        return await cursor.to_list(length=None)
