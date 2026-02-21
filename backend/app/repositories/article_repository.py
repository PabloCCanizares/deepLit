"""
Repositorio de usuarios
"""
from typing import Optional
from app.database import get_database
from app.models import QueryBody
from typing import List, Optional
from pymongo import ASCENDING, DESCENDING

class ArticleRepository:
    
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.articles
    
    async def create(self, article_data: dict) -> str:
        """Crear un nuevo artículo"""
        result = await self.collection.insert_one(article_data)
        # Si usamos _id personalizado, inserted_id será ese _id
        # Si MongoDB genera el _id, usamos result.inserted_id
        return article_data.get("_id") or str(result.inserted_id)
    
    async def find_by_id(self, article_id: str) -> Optional[dict]:
        """Buscar artículo por ID"""
        article = await self.collection.find_one({"_id": article_id})
        return article
    
    async def update(self, article_id: str, update_data: dict) -> Optional[dict]:
        """Actualizar artículo por ID"""
        result = await self.collection.update_one(
            {"_id": article_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return None
        
        # Devolver el artículo actualizado
        return await self.find_by_id(article_id)
    
    async def delete(self, article_id: str) -> bool:
        """Eliminar artículo por ID"""
        result = await self.collection.delete_one({"_id": article_id})
        return result.deleted_count > 0
    
    async def count_documents(self, user_id: str, collection_id: Optional[str] = None) -> int:
        """Contar documentos asociados a un usuario (excluyendo processing/error)"""

        filter_query = {
            "id_user": user_id,
            "status": {"$nin": ["processing", "error"]}
        }
        
        if collection_id:  # Si collection no es None ni vacío
            filter_query["collection_ids"] = {"$in": [collection_id]}
        
        count = await self.collection.count_documents(filter_query)

        return count
    
    async def count_documents_by_year(self, user_id: str, collection_id: Optional[str] = None) -> List[dict]:
        """Contar artículos agrupados por año para un usuario"""
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
        """Obtener artículos en cola (status processing o error) del usuario."""
        cursor = self.collection.find(
            {
                "id_user": user_id,
                "status": {"$in": ["processing", "error"]}
            },
            {
                "_id": 1,
                "title": 1,
                "status": 1,
                "error_message": 1,
                "id_pdf": 1,
            }
        )
        return await cursor.to_list(length=100)

    async def get_user_articles(self, query: QueryBody, user_id: str, collection_id: Optional[str] = None) -> List[dict]:
        """Recuperar artículos del usuario actual con paginación y filtros"""
        
        filter_criteria = {"id_user": user_id}

        # Excluir artículos en procesamiento o con error de la lista normal
        filter_criteria["status"] = {"$nin": ["processing", "error"]}

        if collection_id:
            filter_criteria["collection_ids"] = {"$in": [collection_id]}

        limit = query.pagination.limit
        offset = query.pagination.offset

        sort_criteria = query.sort_by

        filters = query.filters or {}

        # Manejar el filtro 'mode' por separado
        mode_filter = filters.pop("mode", None)

        # ... (procesamiento de filtros y modo como en la respuesta anterior) ...
        if filters:
            for key, value in filters.items():
                if isinstance(value, str) and key not in ["mode"]:
                    filter_criteria[key] = {"$regex": value, "$options": "i"}
                else:
                    filter_criteria[key] = value

        if mode_filter == "complete":
            filter_criteria["title"] = {"$ne": None}
            filter_criteria["year"] = {"$ne": None}
            filter_criteria["pages"] = {"$ne": None}
            filter_criteria["category"] = {"$ne": None}
        elif mode_filter == "incomplete":
            filter_criteria["$or"] = [
                {"title": None},
                {"year": None},
                {"pages": None},
                {"category": None}
            ]

        # Proyección: solo devolver campos necesarios para la lista
        projection = {
            "_id": 1,
            "title": 1,
            "category": 1,
            "pages": 1,
            "year": 1,
            "status": 1
        }

        # 🚀 APLICAR LA LÓGICA DE ORDENACIÓN
        # Creamos la cadena base del cursor
        cursor = self.collection.find(filter_criteria, projection)


        #FIXME hacer con mas campos: añadir campo sortBy (campo), y sortOrder (asc, desc)
        if sort_criteria == "year-asc":
            # Orden ascendente por el campo "year"
            cursor = cursor.sort("year", ASCENDING)
        elif sort_criteria == "year-desc":
            # Orden descendente por el campo "year"
            cursor = cursor.sort("year", DESCENDING)
        else:
            # Si es nulo o no coincide con los valores esperados, 
            # PyMongo no añade ningún sort por defecto (usa el orden natural/inserción)
            pass

        # Aplicar paginación después del sort
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
            {"$limit": 50}  # Limitar a las 50 más frecuentes
        ]

        cursor = self.collection.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        return results

    async def get_article_ids_by_collection(self, collection_id: str) -> List[str]:
        """
        Devuelve una lista de IDs de artículos que pertenecen a una colección.
        Busca por artículos donde 'collection_ids' contiene el collection_id.
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