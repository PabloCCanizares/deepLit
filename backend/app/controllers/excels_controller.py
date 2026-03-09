"""
Controlador de Excels.
"""
import base64
from fastapi import Depends
from app.services.excel_service import ExcelService
from app.services.article_service import ArticleService
from app.models import ExcelUpload
from app.core import StandardResponse


class ExcelsController:
    def __init__(
        self,
        excel_service: ExcelService = Depends(),
        article_service: ArticleService = Depends()
    ):
        # Inyección de dependencias de los 3 services
        self.excel_service = excel_service
        self.article_service = article_service
    
    async def upload_excel(self, excel_data: ExcelUpload, current_user: dict) -> StandardResponse:
        """
        Subir Excel y crear múltiples artículos (uno por fila).
        """
        user_id = current_user.get("_id")
        collection_id = excel_data.collection_id  # Obtener collection_id del request
        
        # PASO 1: Parsear Excel y obtener lista de artículos
        excel_id, articles_data = await self.excel_service.parse_excel(excel_data, user_id)
        
        # PASO 2: Crear artículos (uno por cada fila del Excel)
        created_articles = []
        errors = []
        
        for i, article_data in enumerate(articles_data):
            try:
                article_id = await self.article_service.create_from_excel_row(
                    excel_id=excel_id,
                    row_index=i,
                    user_id=user_id,
                    features=article_data,
                    collection_id=collection_id  # Pasar collection_id al crear el artículo
                )
                created_articles.append({
                    "_id": article_id,
                    **article_data  # Incluye title, abstract, year, etc.
                })
                print(f"✅ Artículo creado: {article_id}" + (f" en colección {collection_id}" if collection_id else ""))
            except Exception as e:
                error_msg = f"Error en fila {i}: {str(e)}"
                errors.append(error_msg)
                print(f"❌ {error_msg}")
        
        # PASO 3: Devolver respuesta con TODOS los artículos creados
        message = f"Excel procesado: {len(created_articles)} artículos creados"
        if errors:
            message += f" ({len(errors)} errores)"
        
        return StandardResponse(
            success=len(created_articles) > 0,
            message=message,
            data={
                "id_excel": excel_id,
                "total_articles": len(created_articles),
                "articles": created_articles,  # Lista completa con IDs
                "errors": errors if errors else None
            }
        )
