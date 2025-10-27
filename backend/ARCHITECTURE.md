# 🏗️ Arquitectura del Backend - deepLit

## 📋 Índice
1. [Patrón de Arquitectura](#patrón-de-arquitectura)
2. [Estructura de Directorios](#estructura-de-directorios)
3. [Flujo de una Petición](#flujo-de-una-petición)
4. [Capas del Sistema](#capas-del-sistema)
5. [Manejo de Excepciones](#manejo-de-excepciones)
6. [Autenticación y Autorización](#autenticación-y-autorización)
7. [Decisiones de Diseño](#decisiones-de-diseño)

---

## 🎯 Patrón de Arquitectura

Este proyecto implementa **Layered Architecture** + **Clean Architecture** con separación clara de responsabilidades.

### **Principios aplicados:**
- ✅ **SOLID** - Cada capa tiene una única responsabilidad
- ✅ **Dependency Injection** - FastAPI inyecta dependencias automáticamente
- ✅ **Separation of Concerns** - Lógica separada por capas
- ✅ **DRY (Don't Repeat Yourself)** - Código reutilizable

---

## 📁 Estructura de Directorios

```
backend/app/
├── core/                    # ⭐ Núcleo transversal
│   ├── auth.py              # JWT, hashing, get_current_user
│   ├── exceptions.py        # Excepciones personalizadas y handlers
│   ├── responses.py         # StandardResponse
│   └── __init__.py          # Exporta todo para imports limpios
│
├── models/                  # 📋 Modelos de datos (Pydantic)
│   ├── user.py              # UserRegister, UserLogin
│   └── __init__.py
│
├── repositories/            # 💾 Acceso a base de datos
│   ├── user_repository.py   # CRUD de usuarios
│   └── __init__.py
│
├── services/                # 🧠 Lógica de negocio
│   ├── auth_service.py      # Lógica de autenticación
│   └── __init__.py
│
├── controllers/             # 🎛️ Formateo de respuestas
│   ├── auth_controller.py   # Formatea respuestas de auth
│   └── __init__.py
│
├── routers/                 # 🛣️ Endpoints HTTP
│   ├── auth.py              # /auth/*
│   ├── health.py            # /
│   └── __init__.py          # include_routers()
│
├── database.py              # 🗄️ Conexión a MongoDB
├── config.py                # ⚙️ Configuración (Pydantic Settings)
└── main.py                  # 🚀 FastAPI app
```

---

## 🔄 Flujo de una Petición

### **Ejemplo: `POST /auth/login`**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Cliente (Frontend)                                           │
│    POST /auth/login                                              │
│    {"email": "user@example.com", "password": "123456"}          │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Router (app/routers/auth.py)                                 │
│    - Recibe la petición HTTP                                    │
│    - Valida el body con Pydantic (UserLogin)                    │
│    - Inyecta dependencias (Controller, get_current_user)        │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Controller (app/controllers/auth_controller.py)              │
│    - Llama al Service                                           │
│    - Formatea la respuesta como StandardResponse                │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Service (app/services/auth_service.py)                       │
│    - Lógica de negocio:                                         │
│      • Buscar usuario por email (vía Repository)                │
│      • Verificar contraseña (vía core/auth.py)                  │
│      • Generar token JWT (vía core/auth.py)                     │
│    - Lanza excepciones si hay errores                           │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Repository (app/repositories/user_repository.py)             │
│    - Operaciones CRUD con MongoDB                               │
│    - Queries a la BD: find_by_email()                           │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. MongoDB                                                       │
│    - Devuelve documento de usuario o None                       │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. Respuesta al Cliente                                         │
│    {                                                            │
│      "success": true,                                           │
│      "message": "Login exitoso",                                │
│      "data": {                                                  │
│        "token": "eyJ...",                                       │
│        "user": {"email": "...", "name": "..."}                  │
│      }                                                          │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
```

### **Si hay un error:**

```
Service lanza: raise AuthenticationError("Email o contraseña incorrectos")
                               ↓
       Exception Handler (app/core/exceptions.py)
       - Captura la excepción
       - Crea StandardResponse con success=False
       - Log: ⚠️  AUTHENTICATION_ERROR en POST /auth/login: ...
                               ↓
                   Respuesta al Cliente
       {
         "success": false,
         "message": "Email o contraseña incorrectos",
         "error": "Email o contraseña incorrectos",
         "error_code": "AUTHENTICATION_ERROR"
       }
```

---

## 📦 Capas del Sistema

### **1️⃣ Routers** (`app/routers/`)

**Responsabilidad:** Definir endpoints HTTP y validar datos de entrada.

```python
from fastapi import APIRouter, Depends
from app.controllers.auth_controller import AuthController
from app.models.user import UserLogin

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login")
async def login(
    user_data: UserLogin,  # ← Valida automáticamente con Pydantic
    controller: AuthController = Depends()  # ← Inyección de dependencias
):
    return await controller.login(user_data.email, user_data.password)
```

**NO hace:**
- ❌ Lógica de negocio
- ❌ Acceso directo a BD
- ❌ Manejo de excepciones (lo hace el handler centralizado)

---

### **2️⃣ Controllers** (`app/controllers/`)

**Responsabilidad:** Formatear respuestas y coordinar Services.

```python
from app.services.auth_service import AuthService
from app.core import StandardResponse

class AuthController:
    def __init__(self):
        self.service = AuthService()
    
    async def login(self, email: str, password: str) -> StandardResponse:
        result = await self.service.login(email, password)
        return StandardResponse(
            success=True,
            message="Login exitoso",
            data=result
        )
```

**Características:**
- ✅ Se crea una **nueva instancia** por cada petición (via `Depends()`)
- ✅ Formatea respuestas de éxito
- ❌ NO maneja excepciones (las deja al handler)

---

### **3️⃣ Services** (`app/services/`)

**Responsabilidad:** Lógica de negocio.

```python
from app.repositories.user_repository import UserRepository
from app.core import hash_password, verify_password, create_access_token
from app.core import AuthenticationError, ConflictError

class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
    
    async def login(self, email: str, password: str) -> dict:
        # 1. Buscar usuario
        user = await self.user_repo.find_by_email(email)
        if not user:
            raise AuthenticationError("Email o contraseña incorrectos")
        
        # 2. Verificar contraseña
        if not verify_password(password, user["password_hash"]):
            raise AuthenticationError("Email o contraseña incorrectos")
        
        # 3. Generar token
        token = create_access_token({"sub": user["email"]})
        
        # 4. Devolver datos
        return {
            "token": token,
            "user": {"email": user["email"], "name": user["name"]}
        }
```

**Características:**
- ✅ **Único lugar** donde se lanza excepciones de negocio
- ✅ Coordina múltiples Repositories
- ✅ Usa funciones de `core/` (auth, etc.)
- ❌ NO formatea respuestas HTTP (eso es del Controller)

---

### **4️⃣ Repositories** (`app/repositories/`)

**Responsabilidad:** Operaciones CRUD con MongoDB.

```python
from app.database import get_database

class UserRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db["users"]
    
    async def find_by_email(self, email: str):
        return await self.collection.find_one({"email": email})
    
    async def create(self, user_data: dict):
        result = await self.collection.insert_one(user_data)
        return str(result.inserted_id)
```

**Características:**
- ✅ **Un Repository por colección/tabla**
- ✅ Solo operaciones de BD (find, insert, update, delete)
- ❌ NO lógica de negocio
- ❌ NO validaciones (eso es del Service)

---

### **5️⃣ Models** (`app/models/`)

**Responsabilidad:** Validar datos de entrada con Pydantic.

```python
from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
```

**Características:**
- ✅ **Validación automática** antes de entrar en el Router
- ✅ Si falla → `RequestValidationError` (422)
- ❌ **NO son modelos de BD** 
- ❌ Solo para validar request/response

---

### **6️⃣ Core** (`app/core/`)

**Responsabilidad:** Funcionalidades transversales.

#### **`core/auth.py`**
```python
# Funciones de autenticación usadas por Services
def hash_password(password: str) -> str
def verify_password(plain: str, hashed: str) -> bool
def create_access_token(data: dict) -> str
async def get_current_user(credentials: HTTPAuthorizationCredentials) -> dict
```

#### **`core/exceptions.py`**
```python
# Excepciones personalizadas
class AuthenticationError(AppException): ...  # 401
class ConflictError(AppException): ...        # 409

# Handlers centralizados
def register_exception_handlers(app): ...
```

#### **`core/responses.py`**
```python
# Formato estándar de respuestas
class StandardResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any]
    error: Optional[str]
    error_code: Optional[str]
```

---

## 🚨 Manejo de Excepciones

### **Tipos de excepciones:**

| Excepción | HTTP Status | Cuándo se lanza |
|-----------|-------------|-----------------|
| `AuthenticationError` | 401 | Credenciales incorrectas, token inválido |
| `ConflictError` | 409 | Email ya registrado, recurso duplicado |
| `NotFoundError` | 404 | Recurso no encontrado |
| `ValidationError` | 400 | Datos inválidos (custom) |
| `RequestValidationError` | 422 | Validación de Pydantic falla |
| `HTTPException` | Variable | FastAPI internamente |
| `Exception` | 500 | Errores inesperados (bugs) |

### **Handlers centralizados:**

```python
# En app/core/exceptions.py
def register_exception_handlers(app):
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
```

**Todos devuelven `StandardResponse`:**
```json
{
  "success": false,
  "message": "Email o contraseña incorrectos",
  "error": "Email o contraseña incorrectos",
  "error_code": "AUTHENTICATION_ERROR"
}
```

**Logs en consola:**
```
⚠️  AUTHENTICATION_ERROR en POST /auth/login: Email o contraseña incorrectos
⚠️  VALIDATION_ERROR en POST /auth/register: email: value is not a valid email
🔥 INTERNAL_SERVER_ERROR en GET /stats: TypeError: ...
```

---

## 🔐 Autenticación y Autorización

### **Flow completo:**

```
1. Usuario → POST /auth/register → Crea cuenta
2. Usuario → POST /auth/login → Recibe token JWT
3. Frontend guarda token en localStorage
4. Todas las peticiones → Authorization: Bearer <token>
5. FastAPI → get_current_user() → Valida token → Extrae user
6. Endpoint → Usa current_user
```

### **Implementación:**

```python
# En app/core/auth.py
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    if credentials is None:
        raise AuthenticationError("No se proporcionó token")
    
    # Decodificar token
    payload = decode_token(credentials.credentials)
    email = payload.get("sub")
    
    if email is None:
        raise AuthenticationError("Token inválido")
    
    # Buscar usuario en BD
    user = await UserRepository().find_by_email(email)
    if user is None:
        raise AuthenticationError("Usuario no encontrado")
    
    return {"email": user["email"], "name": user["name"]}
```

### **Uso en endpoints:**

```python
@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    # current_user contiene: {"email": "...", "name": "..."}
    return StandardResponse(
        success=True,
        message="Usuario obtenido",
        data=current_user
    )
```

---

## 💡 Decisiones de Diseño

### **¿Por qué esta arquitectura?**

#### **1. Escalabilidad**
- Fácil agregar nuevas features sin romper código existente
- Cada capa se prueba independientemente

#### **2. Mantenibilidad**
- Código organizado y fácil de encontrar
- Cambios en una capa no afectan otras

#### **3. Testabilidad**
- Cada capa se mockea fácilmente
- Tests unitarios por capa

#### **4. Reutilización**
- Servicios reutilizables
- Core utilities compartidas

---

### **¿Por qué Pydantic Settings?**

**En vez de `os.getenv()` directo:**

```python
# ❌ Antiguo (sin validación)
SECRET_KEY = os.getenv("SECRET_KEY", "default")

# ✅ Nuevo (con validación)
class Settings(BaseSettings):
    SECRET_KEY: str  # Si no existe en .env → Error al iniciar
```

**Ventajas:**
- ✅ Validación automática de tipos
- ✅ Conversión automática (str → int, etc.)
- ✅ Error claro si falta variable obligatoria
- ✅ Auto-documentación (tipado)
- ✅ **Singleton** (se carga una vez)

---

### **¿Por qué Controllers?**

Algunos frameworks no usan Controllers, van directo de Router → Service.

**Ventajas de tener Controllers:**
- ✅ **Formateo consistente** de respuestas
- ✅ **Coordinación** de múltiples Services si es necesario
- ✅ **Single Responsibility** - Router solo define HTTP, Controller formatea

**Sin Controllers:**
```python
# Router hace todo:
@router.post("/login")
async def login(user_data: UserLogin):
    service = AuthService()
    result = await service.login(user_data.email, user_data.password)
    return StandardResponse(success=True, message="Login exitoso", data=result)
```

**Con Controllers (nuestra elección):**
```python
# Router delega:
@router.post("/login")
async def login(user_data: UserLogin, controller: AuthController = Depends()):
    return await controller.login(user_data.email, user_data.password)
```

---

### **¿Por qué lanzar excepciones en Services?**

**Alternativa:** Devolver `{"success": False, "error": "..."}`

**Problema:** Cada Service debería validar el resultado del anterior:
```python
# ❌ Sin excepciones:
result = await user_repo.find_by_email(email)
if not result["success"]:
    return {"success": False, "error": result["error"]}

result2 = await verify_password(password, user["password"])
if not result2["success"]:
    return {"success": False, "error": result2["error"]}
```

**Solución: Excepciones**
```python
# ✅ Con excepciones:
user = await user_repo.find_by_email(email)  # Si falla → Lanza excepción
if not verify_password(password, user["password"]):
    raise AuthenticationError("Contraseña incorrecta")
```

- ✅ Código más limpio
- ✅ Manejo centralizado de errores
- ✅ No olvidar validar

---

### **¿Por qué async/await?**

**MongoDB con Motor** es async, FastAPI es async.

```python
# ✅ Async (no bloquea el servidor)
user = await self.collection.find_one({"email": email})

# ❌ Sync (bloquea el servidor mientras espera la BD)
user = self.collection.find_one({"email": email})
```

**Ventaja:** El servidor puede atender otras peticiones mientras espera respuestas de MongoDB.

---

## 📈 Mejoras Futuras

### **Transacciones de MongoDB**
Para operaciones complejas que requieren atomicidad:

```python
async with await self.client.start_session() as session:
    async with session.start_transaction():
        await collection1.insert_one(data1, session=session)
        await collection2.update_one(query, update, session=session)
        # Si algo falla → Rollback automático
```

### **Caching**
Para endpoints que no cambian frecuentemente:

```python
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache

@router.get("/stats")
@cache(expire=3600)  # Cache 1 hora
async def get_stats():
    ...
```

### **Rate Limiting**
Para proteger contra ataques:

```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")
async def login():
    ...
```

---

