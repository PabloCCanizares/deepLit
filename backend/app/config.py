"""
Configuración de la aplicación usando Pydantic Settings.

Carga automáticamente variables desde .env y las valida.
Si falta alguna variable obligatoria o el tipo es incorrecto, la app no arranca.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """
    Configuración de la aplicación.
    
    Variables con valor por defecto = opcionales
    Variables sin valor por defecto = obligatorias (deben estar en .env)
    """
    
    # ============================================
    # APP
    # ============================================
    APP_NAME: str = "deepLit API"
    DEBUG: bool = True
    
    # ============================================
    # SERVER
    # ============================================
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # ============================================
    # DATABASE
    # ============================================
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "deeplit"
    
    # ============================================
    # SECURITY
    # ============================================
    SECRET_KEY: str  # OBLIGATORIA en .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 horas
    
    # ============================================
    # CORS
    # ============================================
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    
    # ============================================
    # STORAGE (Almacenamiento de archivos)
    # ============================================
    # Directorio base para todos los archivos
    STORAGE_BASE_DIR: str = "./storage"
    
    UPLOADS_DIR: str = "uploads"
    PROFILES_DIR: str = "profiles"
    COLLECTIONS_DIR: str = "collections"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def get_origins_list(self) -> List[str]:
        """
        Convierte ALLOWED_ORIGINS de string a lista. (Se requiere para CORS)
        """
        if isinstance(self.ALLOWED_ORIGINS, str):
            return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(',')]
        return self.ALLOWED_ORIGINS


# ============================================
# INSTANCIA GLOBAL
# ============================================
# Se carga automáticamente al importar este módulo desde el main.py
settings = Settings()