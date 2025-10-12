# 🚀 deepLit Backend - FastAPI

---

## 📋 Características

- ✅ **FastAPI** - Framework moderno y rápido
- ✅ **MongoDB** - Base de datos NoSQL con Motor (async)
- ✅ **JWT Authentication** - Autenticación con tokens seguros
- ✅ **Arquitectura en Capas** - Clean Architecture (Router → Controller → Service → Repository)
- ✅ **Manejo Centralizado de Errores** - Todas las respuestas siguen el mismo formato
- ✅ **Validación con Pydantic** - Validación automática de datos
- ✅ **Configuración con Pydantic Settings** - Variables de entorno tipadas
- ✅ **Documentación Automática** - Swagger UI en `/docs`

---

## 🏗️ Arquitectura

```
Cliente → Router → Controller → Service → Repository → MongoDB
          (HTTP)   (formato)    (lógica)   (queries)
```

### **Capas:**
- **Routers** (`/routers`) → Definen endpoints HTTP
- **Controllers** (`/controllers`) → Formatean respuestas
- **Services** (`/services`) → Lógica de negocio
- **Repositories** (`/repositories`) → Operaciones CRUD con MongoDB
- **Models** (`/models`) → Validación de datos con Pydantic
- **Core** (`/core`) → Funcionalidades transversales (auth, exceptions, responses)

**Ver más:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📁 Estructura del Proyecto

```
backend/
├── app/
│   ├── main.py              # 🚀 Aplicación principal FastAPI
│   ├── config.py            # ⚙️ Configuración (Pydantic Settings)
│   ├── database.py          # 🗄️ Conexión a MongoDB
│   │
│   ├── core/                # ⭐ Núcleo
│   │   ├── auth.py          # JWT, hashing, get_current_user
│   │   ├── exceptions.py    # Excepciones personalizadas y handlers
│   │   └── responses.py     # StandardResponse
│   │
│   ├── models/              # 📋 Modelos Pydantic
│   │   └── user.py          # UserRegister, UserLogin
│   │
│   ├── repositories/        # 💾 Acceso a datos
│   │   └── user_repository.py
│   │
│   ├── services/            # 🧠 Lógica de negocio
│   │   └── auth_service.py
│   │
│   ├── controllers/         # 🎛️ Formateo
│   │   └── auth_controller.py
│   │
│   └── routers/             # 🛣️ Endpoints
│       ├── auth.py          # /auth/*
│       └── health.py        # /
│
├── .env                     # 🔐 Variables de entorno (NO subir a git)
├── requirements.txt         # 📦 Dependencias
├── README.md               # 📖 Este archivo
└── ARCHITECTURE.md         # 📚 Documentación de arquitectura
```

---

## 🚀 Instalación y Uso

### **Requisitos previos:**
- **Python 3.12.11** (versión específica usada en desarrollo)
- **MongoDB** instalado y corriendo en `localhost:27017`

---

### **1️⃣ Instalar Python 3.12.11**

**Verificar si ya tienes Python 3.12.11:**
```bash
python3.12 --version
# o
/opt/homebrew/bin/python3.12 --version  # macOS con Homebrew
```

**Si NO tienes Python 3.12.11, instálalo:**

#### **🍎 macOS (Homebrew)**

```bash

# Instalar Python 3.12
brew install python@3.12

# Verificar instalación
/opt/homebrew/bin/python3.12 --version
```

#### **🪟 Windows**

1. Descargar Python 3.12.11 desde [python.org](https://www.python.org/downloads/)
2. Ejecutar el instalador
3. ✅ **IMPORTANTE:** Marcar "Add Python to PATH"
4. Verificar en CMD:
```cmd
py -3.12 --version
```

---

### **2️⃣ Crear entorno virtual con Python 3.12.11**

```bash
cd backend

# macOS/Linux (buscar automáticamente python3.12)
python3.12 -m venv venv

# macOS con Homebrew (ruta específica si el anterior no funciona)
/opt/homebrew/bin/python3.12 -m venv venv

# Windows
py -3.12 -m venv venv

# Activar entorno virtual
source venv/bin/activate  # macOS/Linux
# o
venv\Scripts\activate     # Windows

# Verificar que estás usando la versión correcta
python --version  # Debe mostrar: Python 3.12.11
```

---

### **3️⃣ Instalar dependencias**

```bash
pip install -r requirements.txt
```

---

### **4️⃣ Configurar variables de entorno**

**Genera tu SECRET_KEY:**
```bash
openssl rand -hex 32
```

**Crea el archivo `.env`:**
```bash
# backend/.env
SECRET_KEY=tu_secret_key_generada_aqui
DEBUG=True
```

**Variables disponibles:**
```env
# Obligatorias
SECRET_KEY=...                          # Clave secreta para JWT (OBLIGATORIA)

# Opcionales (tienen defaults en config.py)
DEBUG=True                              # Modo debug (default: True)
PORT=8000                               # Puerto del servidor (default: 8000)
MONGODB_URL=mongodb://localhost:27017   # URL de MongoDB
DATABASE_NAME=deeplit                   # Nombre de la BD (default: deeplit)
ALLOWED_ORIGINS=http://localhost:3000   # CORS (default: localhost:3000)
ACCESS_TOKEN_EXPIRE_MINUTES=480         # Expiración del token en minutos (default: 8 horas)
```

---

### **5️⃣ Iniciar el servidor**

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**El servidor estará en:**
- API: http://localhost:8000
- Documentación (Swagger): http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 📡 Endpoints Disponibles

### **Health Check**
```http
GET /
```
Verifica que la API está funcionando.

### **Autenticación**

```http
POST /auth/register
Content-Type: application/json

{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123"
}
```

```http
POST /auth/login
Content-Type: application/json

{
  "email": "juan@example.com",
  "password": "password123"
}
```

```http
GET /auth/me
Authorization: Bearer <token>
```

```http
POST /auth/logout
Authorization: Bearer <token>
```

---

## 🔐 Autenticación

### **Flujo:**
1. Usuario se registra → `/auth/register`
2. Usuario hace login → `/auth/login` → Recibe `token`
3. Frontend guarda el `token` en `localStorage`
4. Todas las peticiones protegidas incluyen: `Authorization: Bearer <token>`

### **Endpoints protegidos:**
```python
from app.core import get_current_user
from fastapi import Depends

@router.get("/protected")
async def protected_route(current_user: dict = Depends(get_current_user)):
    # current_user contiene: {"email": "...", "name": "..."}
    return {"message": f"Hola {current_user['name']}"}
```

---

## 📊 Formato de Respuestas

**Todas las respuestas** (éxito y error) siguen el mismo formato `StandardResponse`:

### **Éxito:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "email": "juan@example.com",
    "name": "Juan Pérez"
  },
  "error": null,
  "error_code": null
}
```

### **Error:**
```json
{
  "success": false,
  "message": "Email o contraseña incorrectos",
  "data": null,
  "error": "Email o contraseña incorrectos",
  "error_code": "AUTHENTICATION_ERROR"
}
```

**Códigos de error comunes:**
- `AUTHENTICATION_ERROR` (401) - Credenciales incorrectas / Token inválido
- `CONFLICT_ERROR` (409) - Email ya registrado
- `VALIDATION_ERROR` (422) - Datos mal formateados
- `INTERNAL_SERVER_ERROR` (500) - Error del servidor

---

## 🛠️ Comandos Útiles

### **Desarrollo:**
```bash
# Verificar versión de Python del venv
python --version

# Iniciar servidor con recarga automática
python -m uvicorn app.main:app --reload

# Ver logs en consola (los exception handlers imprimen logs)
```

### **Testing:**
```bash
# Probar endpoints manualmente
curl http://localhost:8000/
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}'
```

### **MongoDB:**
```bash
# Ver usuarios en la BD
mongosh
> use deeplit
> db.users.find().pretty()
```

---

## 🏗️ Añadir Nuevos Endpoints

### **Ejemplo: Crear endpoint de documentos**

**1. Crear modelo** (`app/models/document.py`):
```python
from pydantic import BaseModel

class DocumentCreate(BaseModel):
    title: str
    content: str
```

**2. Crear repositorio** (`app/repositories/document_repository.py`):
```python
from app.database import get_database

class DocumentRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db["documents"]
    
    async def create(self, doc_data: dict):
        result = await self.collection.insert_one(doc_data)
        return str(result.inserted_id)
```

**3. Crear servicio** (`app/services/document_service.py`):
```python
from app.repositories.document_repository import DocumentRepository

class DocumentService:
    def __init__(self):
        self.repo = DocumentRepository()
    
    async def create_document(self, doc_data: dict):
        doc_id = await self.repo.create(doc_data)
        return {"id": doc_id, **doc_data}
```

**4. Crear controller** (`app/controllers/document_controller.py`):
```python
from app.services.document_service import DocumentService
from app.core import StandardResponse

class DocumentController:
    def __init__(self):
        self.service = DocumentService()
    
    async def create(self, doc_data: dict) -> StandardResponse:
        result = await self.service.create_document(doc_data)
        return StandardResponse(
            success=True,
            message="Documento creado",
            data=result
        )
```

**5. Crear router** (`app/routers/documents.py`):
```python
from fastapi import APIRouter, Depends
from app.controllers.document_controller import DocumentController
from app.models.document import DocumentCreate
from app.core import get_current_user

router = APIRouter(prefix="/documents", tags=["Documentos"])

@router.post("/")
async def create_document(
    doc: DocumentCreate,
    current_user: dict = Depends(get_current_user),
    controller: DocumentController = Depends()
):
    return await controller.create(doc.dict())
```

**6. Registrar router** (`app/routers/__init__.py`):
```python
from app.routers import auth, health, documents

def include_routers(app):
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(documents.router)  # ← Añadir
```

---

## 🐛 Debugging

### **Logs en consola:**
Los exception handlers imprimen logs automáticamente:
```
⚠️  AUTHENTICATION_ERROR en POST /auth/login: Email o contraseña incorrectos
⚠️  VALIDATION_ERROR en POST /auth/register: email: value is not a valid email address
🔥 INTERNAL_SERVER_ERROR en GET /stats: TypeError: ...
```

### **Swagger UI:**
- Ve a http://localhost:8000/docs
- Prueba endpoints directamente desde el navegador
- Ve los esquemas de request/response

### **Modo Debug:**
En `.env`, pon `DEBUG=True` para ver detalles completos de errores (stacktrace).

---

## 📚 Recursos

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Pydantic Docs](https://docs.pydantic.dev/)
- [Motor (MongoDB Async)](https://motor.readthedocs.io/)
- [JWT Docs](https://jwt.io/)

---

## 🤝 Contribuir

1. Mantén la arquitectura en capas
2. Lanza excepciones desde `services` (no desde `controllers` o `routers`)
3. Usa `StandardResponse` para todas las respuestas de éxito
4. Documenta endpoints con docstrings
5. Sigue los nombres de las excepciones existentes en `core/exceptions.py`

---

## 📝 Notas

- **NO subir `.env` a git** → Ya está en `.gitignore`
- **MongoDB debe estar corriendo** antes de iniciar el servidor
- **Los tokens expiran** después de 8 horas (configurable en `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Todas las operaciones de BD son async** (usa `await`)
