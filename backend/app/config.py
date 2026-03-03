"""
Configuracion de la aplicacion usando Pydantic Settings.

Carga automaticamente variables desde .env y las valida.
Si falta alguna variable obligatoria o el tipo es incorrecto, la app no arranca.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Configuracion de la aplicacion.

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
    STORAGE_BASE_DIR: str = "./storage"
    UPLOADS_DIR: str = "uploads"
    PROFILES_DIR: str = "profiles"
    COLLECTIONS_DIR: str = "collections"

    # ============================================
    # AI ASSISTANT
    # ============================================
    # Modo de despliegue del backend (fuente de verdad)
    # True -> modelos locales (Ollama)
    # False -> proveedor remoto (Gemini)
    OFFLINE: bool = True
    GOOGLE_API_KEY: Optional[str] = None

    # WEB SEARCH (agente web)
    WEB_SEARCH_PROVIDER: str = "duckduckgo"  # duckduckgo | hackernews
    WEB_SEARCH_CACHE_TTL_MINUTES: int = 30
    WEB_SEARCH_MAX_RESULTS: int = 8
    WEB_SEARCH_REQUIRE_TRUSTED_SOURCES: bool = True
    WEB_SEARCH_MIN_TRUSTED_SOURCES: int = 2
    WEB_TRUSTED_DOMAINS: str = (
        "reuters.com,apnews.com,bbc.com,nytimes.com,washingtonpost.com,"
        "nature.com,science.org,arxiv.org,who.int,nih.gov,cdc.gov,europa.eu,"
        "openai.com,github.com,wikipedia.org"
    )

    # ============================================
    # NEO4J (Knowledge Graph) - opcional
    # ============================================
    NEO4J_URL: Optional[str] = None
    NEO4J_USERNAME: Optional[str] = None
    NEO4J_PASSWORD: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

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
# Se carga automaticamente al importar este modulo desde el main.py
settings = Settings()
