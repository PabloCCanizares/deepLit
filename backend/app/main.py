"""
Aplicación principal FastAPI
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.core import register_exception_handlers
from app.routers import include_routers
from app.services import StorageService
from app.workers.job_worker import JobWorker


# ============================================
# APLICACIÓN
# ============================================

app = FastAPI(
    title=settings.APP_NAME,
    description="API REST para gestión de literatura científica",
    version="1.0.0",
    debug=settings.DEBUG
)


# ============================================
# EXCEPTION HANDLERS
# ============================================

register_exception_handlers(app)


# ============================================
# CORS
# ============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# EVENTOS
# ============================================

@app.on_event("startup")
async def startup():
    """Ejecutado al iniciar el servidor"""
    # Conectar a MongoDB
    await connect_to_mongo()
    
    StorageService()
    app.state.job_worker = JobWorker()
    await app.state.job_worker.start()
    
    print(f"✅ {settings.APP_NAME} iniciado correctamente")


@app.on_event("shutdown")
async def shutdown():
    """Ejecutado al cerrar el servidor"""
    job_worker = getattr(app.state, "job_worker", None)
    if job_worker is not None:
        await job_worker.stop()
    await close_mongo_connection()
    print(f"👋 {settings.APP_NAME} cerrado")


# ============================================
# ROUTERS
# ============================================

include_routers(app)
