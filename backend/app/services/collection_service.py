"""
Servicio de Colecciones.
"""
import re
import base64
from datetime import datetime
from typing import List, Dict, Optional
from app.repositories.collection_repository import CollectionRepository
from app.repositories.article_repository import ArticleRepository
from app.services.storage_service import StorageService
from app.core import NotFoundError, AuthorizationError


class CollectionService:
    
    def __init__(self):
        self.collection_repo = CollectionRepository()
        self.article_repo = ArticleRepository()
        self.storage_service = StorageService()
    
    async def create(self, user_id: str, name: str, description: str = None, color: str = "#3B82F6", image = None, collection_id : str = None) -> Dict:
        """
        Crear una nueva colección.
        """
        # Generar ID único
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # La colección personal 'Sin colección' usa el user_id como collection_id
        if collection_id != user_id:
            collection_id = f"col_{name.lower().replace(' ', '_')}_{timestamp}"
        
        collection_data = {
            "_id": collection_id,
            "id_user": user_id,
            "name": name,
            "description": description,
            "color": color
        }
        
        # Guardar imagen si se proporciona (base64)
        if image:
            print(f"Collection ID: {collection_id}")
            print(f"Image type: {type(image)}")
            print(f"Image length: {len(image) if image else 0}")
            print(f"Image starts with: {image[:50] if image else 'None'}...")
            try:
                filename = await self._save_collection_image(collection_id, image)
                collection_data["image_url"] = filename
                print(f"Image saved as: {filename}")
                print(f"=== IMAGEN GUARDADA ===")
            except Exception as e:
                print(f"ERROR saving image: {e}")
                import traceback
                traceback.print_exc()
                # Continue without image
        else:
            print("No image provided")
        
        await self.collection_repo.create(collection_data)
        
        # El repository ya añadió created_at y updated_at al dict original
        # Añadir conteo de artículos (siempre 0 al crear)
        collection_data["article_count"] = 0
        
        return collection_data
    
    '''
    async def get_collection_id_by_name(self, user_id: str, collection_name: Optional[str] = None) -> Optional[str]:
        """
        Obtener el ID de una colección por su nombre y usuario.
        """
        collection = await self.collection_repo.find_by_name_and_user(user_id,collection_name)
        if collection:
            return collection["_id"]
        return None
    '''

    async def collection_exists(self, user_id: str, collection_id: str) -> bool:
        """
        Verificar si una colección existe y pertenece al usuario.
        """
        collection = await self.collection_repo.find_by_id(collection_id)
        if collection and collection.get("id_user") == user_id:
            return True
        return False

    async def delete(self, collection_id: str, user_id: str) -> bool:
        """
        Eliminar una colección.
        Los artículos NO se eliminan, solo se quita el collection_id de ellos.
        """
        # Verificar que existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        
        if not collection:
            raise NotFoundError("Colección no encontrada")
        
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para eliminar esta colección")
        
        # Eliminar imagen si existe
        image_url = collection.get("image_url")
        if image_url:
            try:
                self.storage_service.delete_file(image_url, storage_location="collections")
            except Exception:
                pass  # Si falla al eliminar la imagen, continuar
        
        # Eliminar la colección
        return await self.collection_repo.delete(collection_id)

    async def delete_many(self, collection_ids: List[str], user_id: str) -> int:
        """
        Eliminar múltiples colecciones.
        Verifica que todas pertenezcan al usuario.
        Los artículos NO se eliminan.
        """
        # Verificar que todas las colecciones pertenecen al usuario
        valid_ids = []
        for cid in collection_ids:
            collection = await self.collection_repo.find_by_id(cid)
            if collection and collection.get("id_user") == user_id:
                # Eliminar imagen si existe
                image_url = collection.get("image_url")
                if image_url:
                    try:
                        self.storage_service.delete_file(image_url, storage_location="collections")
                    except Exception:
                        pass
                valid_ids.append(cid)
        
        if not valid_ids:
            return 0
        
        return await self.collection_repo.delete_many(valid_ids)


    async def get_collection_with_articles(
        self, 
        collection_id: str, 
        user_id: str,
        limit: int = 100,
        offset: int = 0
    ) -> Dict:
        """
        Obtener colección con sus artículos.
        """
        # Verificar que existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        
        if not collection:
            raise NotFoundError("Colección no encontrada")
        
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a esta colección")
        
        if collection["_id"] == user_id:
            raise AuthorizationError("No se puede obtener la colección 'Sin colección' con artículos.")
        
        # Obtener conteo y artículos de la colección
        article_count = await self.collection_repo.count_articles_in_collection(collection_id)
        articles = await self.collection_repo.get_articles_in_collection(
            collection_id, 
            limit=limit, 
            offset=offset
        )
        
        collection["article_count"] = article_count
        collection["articles"] = articles
        
        return collection
    
    async def get_user_collections(self, user_id: str) -> List[Dict]:
        """
        Obtener todas las colecciones de un usuario.
        """
        collections = await self.collection_repo.find_by_user(user_id)
        
        colecciones_filtradas = []
        # Añadir conteo de artículos a cada colección
        for collection in collections:
            if collection["_id"] != user_id:  # Excluir colección 'Sin colección'
                article_count = await self.collection_repo.count_articles_in_collection(
                    collection["_id"]
                )
                collection["article_count"] = article_count

                colecciones_filtradas.append(collection)
        
        return colecciones_filtradas
    
    async def add_article_to_collection(
        self, 
        collection_id: str, 
        article_id: str, 
        user_id: str
    ) -> bool:
        """
        Añadir un artículo a una colección.
        Verifica que ambos pertenezcan al usuario.
        """
        # Verificar que la colección existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        if not collection:
            raise NotFoundError("Colección no encontrada")
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar esta colección")
        
        # Verificar que el artículo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        if not article:
            raise NotFoundError("Artículo no encontrado")
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artículo")
        
        # Añadir artículo a la colección
        result = await self.collection_repo.add_article_to_collection(collection_id, article_id)
        
        return result
    
    async def remove_article_from_collection(
        self, 
        collection_id: str, 
        article_id: str, 
        user_id: str
    ) -> bool:
        """
        Quitar un artículo de una colección.
        Verifica que ambos pertenezcan al usuario.
        """
        # Verificar que la colección existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        if not collection:
            raise NotFoundError("Colección no encontrada")
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar esta colección")
        
        # Verificar que el artículo existe y pertenece al usuario
        article = await self.article_repo.find_by_id(article_id)
        if not article:
            raise NotFoundError("Artículo no encontrado")
        if article.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar este artículo")
        
        # Quitar artículo de la colección
        result = await self.collection_repo.remove_article_from_collection(collection_id, article_id)
        
        return result

    async def update(
        self, 
        collection_id: str, 
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        image = None
    ) -> Dict:
        """
        Actualizar una colección existente.
        """
        # Verificar que la colección existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        if not collection:
            raise NotFoundError("Colección no encontrada")
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para modificar esta colección")
        
        # Preparar datos de actualización
        update_data = {}
        if name is not None:
            update_data["name"] = name
        if description is not None:
            update_data["description"] = description
        if color is not None:
            update_data["color"] = color
        
        # Guardar nueva imagen si se proporciona (base64)
        if image is not None:
            # Eliminar imagen antigua si existe
            old_image = collection.get("image_url")
            if old_image:
                self.storage_service.delete_file(old_image, storage_location="collections")
            
            filename = await self._save_collection_image(collection_id, image)
            update_data["image_url"] = filename
        
        # Actualizar en base de datos
        if update_data:
            await self.collection_repo.update(collection_id, update_data)
        
        # Retornar colección actualizada
        updated_collection = await self.collection_repo.find_by_id(collection_id)
        return updated_collection
    
    async def _save_collection_image(self, collection_id: str, base64_data: str) -> str:
        """
        Guarda la imagen de colección en disco y retorna el nombre del archivo.
        """
        # Extraer el tipo de imagen y el contenido base64
        if ',' in base64_data:
            header, base64_content = base64_data.split(',', 1)
            match = re.search(r'image/(\w+)', header)
            extension = match.group(1) if match else 'jpg'
            if extension == 'jpeg':
                extension = 'jpg'
        else:
            base64_content = base64_data
            extension = 'jpg'
        
        # Generar nombre único
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{collection_id}_{timestamp}.{extension}"
        
        # Decodificar base64
        try:
            image_content = base64.b64decode(base64_content)
        except Exception as e:
            raise ValueError(f"Error al decodificar imagen base64: {str(e)}")
        
        # Guardar archivo en storage/collections/
        self.storage_service.save_file(
            content=image_content,
            filename=filename,
            storage_location="collections"
        )
        
        return filename
    
    async def get_ids_from_collection(self, collection_id: str, user_id: str) -> List[str]:
        """
        Obtener IDs de artículos en una colección.
        Verifica que la colección pertenezca al usuario.
        """
        # Verificar que existe y pertenece al usuario
        collection = await self.collection_repo.find_by_id(collection_id)
        
        if not collection:
            raise NotFoundError("Colección no encontrada")
        
        if collection.get("id_user") != user_id:
            raise AuthorizationError("No tienes permiso para acceder a esta colección")
        
        # Obtener artículos de la colección
        article_ids = await self.article_repo.get_article_ids_by_collection(collection_id)
                
        return article_ids

    async def get_my_article_ids(self, user_id: str) -> List[str]:
        """
        Obtener IDs de todos los artículos del usuario (Mis Artículos).
        Busca artículos donde collection_ids contiene el user_id.
        """
        article_ids = await self.article_repo.get_article_ids_by_collection(user_id)
        return article_ids
