from pydantic import BaseModel, Field
from typing import Optional, Any, Dict

def create_response_examples(
    success_example: Optional[Dict] = None,
    error_example: Optional[Dict] = None
) -> Dict:
    """
    Crea la estructura de ejemplos ordenados para la documentación OpenAPI.
    """
    examples = {}
    
    if success_example:
        examples["success"] = {
            "summary": "Respuesta exitosa",
            "value": {
                "success": True,
                "message": success_example.get("message", "Operación exitosa"),
                "data": success_example.get("data"),
                "error": None,
                "error_code": None
            }
        }
    
    if error_example:
        examples["error"] = {
            "summary": "Respuesta de error",
            "value": {
                "success": False,
                "message": error_example.get("message", "Error al procesar la solicitud"),
                "data": None,
                "error": error_example.get("error", "Descripción del error"),
                "error_code": error_example.get("error_code", "ERROR_CODE")
            }
        }
    
    return {
        200: {
            "description": "Successful Response",
            "content": {
                "application/json": {
                    "examples": examples
                }
            }
        }
    }


class StandardResponse(BaseModel):
    """
    Respuesta estándar para todas las peticiones (éxito y error).
    """
    success: bool = Field(..., description="Indica si la operación fue exitosa")
    message: str = Field(..., description="Mensaje descriptivo de la respuesta")
    data: Optional[Any] = Field(None, description="Datos de la respuesta (None en caso de error)")
    error: Optional[str] = Field(None, description="Mensaje de error (None en caso de éxito)")
    error_code: Optional[str] = Field(None, description="Código del error (None en caso de éxito)")

