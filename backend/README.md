# deepLit Backend - API REST (FastAPI)

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-NoSQL-47A248.svg?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Neo4j](https://img.shields.io/badge/Neo4j-Graph_DB-008CC1.svg?style=flat-square&logo=neo4j&logoColor=white)](https://neo4j.com)

El backend de deepLit provee una API REST robusta construida con FastAPI. Ofrece una arquitectura en capas limpia, procesamiento asíncrono para ingesta de documentos, integración con base de datos NoSQL para almacenamiento persistente de metadatos y usuarios, y base de datos orientada a grafos para analizar relaciones de literatura. Además, integra agentes de inteligencia artificial y flujos de RAG (Retrieval-Augmented Generation).

---

## Características Clave

- **Clean Architecture:** Diseño ordenado en capas bien definidas: Router → Controller → Service → Repository → Database.
- **Procesamiento de Documentos:** Extracción y parsing OCR de PDFs con PyMuPDF y RapidOCR.
- **Grafo de Artículos (Neo4j):** Ingesta automatizada y mapeo de relaciones entre artículos, autores, palabras clave y categorías.
- **Flujos RAG y Agentes (LangChain & LangGraph):**
  - **Screening:** Filtrado y clasificación sistemática.
  - **Clustering:** Agrupamiento temático de artículos mediante embeddings.
  - **Evidence Extraction:** Extracción inteligente de evidencias específicas de los documentos.
  - **Collection Synthesis:** Síntesis y análisis de resúmenes de colecciones completas.
  - **Asistente de Redacción (Redaction):** Apoyo interactivo para escribir literatura científica.
- **Autenticación JWT:** Gestión de usuarios, sesiones y seguridad con cifrado bcrypt.
- **Manejo Centralizado de Errores:** Respuestas formateadas y estandarizadas con StandardResponse.
- **Documentación Interactiva:** Autogenerada en `/docs` (Swagger) y `/redoc` (ReDoc).

---

## Arquitectura de Capas

```
Cliente HTTP → Routers → Controllers → Services → Repositories → MongoDB/Neo4j
               (HTTP)    (Formateo)    (Lógica)    (CRUD/Query)   (Persistencia)
```

- **Routers** (`app/routers/`): Definen los endpoints HTTP, validan parámetros y controlan la autorización mediante dependencias.
- **Controllers** (`app/controllers/`): Orquestan la lógica y preparan las respuestas estandarizadas.
- **Services** (`app/services/`): Contienen la lógica de negocio, invocaciones a modelos de lenguaje (LLM), agentes e integraciones externas.
- **Repositories** (`app/repositories/`): Realizan las consultas de lectura/escritura a la base de datos MongoDB.
- **Models** (`app/models/`): Esquemas Pydantic para validación estricta de requests y responses.
- **Core** (`app/core/`): Utilidades transversales como seguridad, autenticación, excepciones personalizadas y estructura de respuestas.

---

## Estructura del Directorio

```
backend/
├── app/
│   ├── main.py              # Aplicación principal FastAPI y arranque
│   ├── config.py            # Configuración cargada desde variables de entorno
│   ├── database.py          # Clientes de MongoDB y funciones de conexión
│   │
│   ├── core/                # Funcionalidades transversales y utilidades
│   │   ├── auth.py          # Autenticación, JWT y Hashing
│   │   ├── exceptions.py    # Manejador global de excepciones
│   │   └── responses.py     # Modelo estandarizado StandardResponse
│   │
│   ├── models/              # Modelos Pydantic para validación de datos
│   │   ├── auth.py          # Peticiones de Login/Registro
│   │   ├── user.py          # Estructura del Perfil de Usuario
│   │   ├── article.py       # Estructura de Artículos y metadatos
│   │   ├── collection.py    # Modelos de Colecciones
│   │   └── screening.py     # Modelos de Cribado/Screening
│   │
│   ├── repositories/        # Consultas directas a Base de Datos (MongoDB)
│   │   ├── user_repository.py
│   │   ├── article_repository.py
│   │   └── collection_repository.py
│   │
│   ├── services/            # Lógica de negocio y agentes IA (RAG)
│   │   ├── auth_service.py         # Control de tokens y accesos
│   │   ├── article_service.py      # Gestión de artículos
│   │   ├── article_graph_service.py# Ingesta y consultas en Neo4j
│   │   ├── openalex_service.py     # Integración externa con OpenAlex
│   │   ├── pdf_service.py          # Parsing de PDFs y metadatos
│   │   ├── excel_service.py        # Importación masiva desde archivos XLSX
│   │   ├── ai_assistant_service.py # Lógica de chat RAG general
│   │   └── extraction_service.py   # Extracción de entidades por LLM
│   │
│   ├── controllers/         # Adaptación y formateo de respuestas de negocio
│   │
│   ├── routers/             # Rutas expuestas de la API
│   │   ├── auth.py          # Registro y Login
│   │   ├── articles.py      # Gestión de literatura local
│   │   ├── article_graph.py # Endpoints para consultar el grafo Neo4j
│   │   ├── collections.py   # Agrupamiento de artículos por colecciones
│   │   ├── screening.py     # Flujo de revisión sistemática
│   │   ├── openalex.py      # Búsqueda en catálogo OpenAlex
│   │   ├── ai_assistant.py  # Interacción con asistente de IA
│   │   └── redaction.py     # Copiloto de redacción científica
│   │
│   └── workers/             # Procesamiento asíncrono en background
│       └── job_worker.py    # Worker para tareas de larga duración (OCR, RAG)
│
├── storage/                 # Almacenamiento local de PDFs subidos (ignorado en git)
├── tests/                   # Suite de pruebas automatizadas
├── .env.example             # Plantilla de variables de entorno
├── requirements.txt         # Dependencias de librerías Python
└── README.md                # Este documento
```

---

## Instalación y Uso

### Requisitos Previos
- Python 3.12.x
- MongoDB (ejecutándose localmente en `mongodb://localhost:27017`)
- Neo4j (opcional, por defecto en `bolt://localhost:7687`)

### Pasos de Instalación

1. **Crear y activar entorno virtual:**
   ```bash
   # Windows
   py -3.12 -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python3.12 -m venv venv
   source venv/bin/activate
   ```

2. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar el archivo `.env`:**
   Copia la plantilla de variables de entorno y define tu clave secreta:
   ```bash
   cp .env.example .env
   ```
   Genera una clave para `SECRET_KEY`:
   ```bash
   openssl rand -hex 32
   ```
   Edite el archivo `.env` recién creado con su editor y pegue el valor generado en `SECRET_KEY`, además de su `GOOGLE_API_KEY` para el LLM.

4. **Ejecutar el servidor en desarrollo:**
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

El servidor web de desarrollo iniciará en `http://localhost:8000`.

---

## Documentación y Endpoints

### Swagger UI interactivo
- Dirección: `http://localhost:8000/docs`
- Permite probar los endpoints en vivo, adjuntar archivos PDF y simular autorizaciones con JWT.

### Endpoints principales
- **`GET /`**: Health check.
- **`POST /auth/register`** y **`POST /auth/login`**: Gestión de accesos.
- **`GET /user/profile`**: Datos del usuario logueado.
- **`POST /pdfs/upload`**: Subida e ingesta individual o múltiple de archivos PDF.
- **`POST /excels/upload`**: Ingesta masiva de literatura mediante plantillas Excel.
- **`GET /articles`**: Listado, paginación y búsqueda de literatura guardada.
- **`POST /collections`**: Creación de colecciones para organizar lecturas.
- **`POST /screening/classify`**: Cribado inteligente de literatura mediante agentes.
- **`POST /clustering`**: Agrupamiento temático inteligente.
- **`POST /collection-synthesis`**: Resúmenes exhaustivos de colecciones.
- **`POST /article-graph/query`**: Consultas directas al grafo de conocimiento de Neo4j.

---

## Formato de Respuesta del Sistema

Para garantizar que el frontend procese correctamente la información, el backend responde usando la estructura `StandardResponse`:

### Respuesta Exitosa
```json
{
  "success": true,
  "message": "Operación completada con éxito",
  "data": {
    "items": []
  },
  "error": null,
  "error_code": null
}
```

### Respuesta con Error
```json
{
  "success": false,
  "message": "Credenciales inválidas",
  "data": null,
  "error": "El correo o contraseña no coinciden",
  "error_code": "AUTHENTICATION_ERROR"
}
```

Códigos de error de la API comunes:
- `AUTHENTICATION_ERROR` (401)
- `VALIDATION_ERROR` (422)
- `NOT_FOUND_ERROR` (404)
- `CONFLICT_ERROR` (409)
- `INTERNAL_SERVER_ERROR` (500)

---

## Pruebas unitarias
Para verificar que el sistema funciona correctamente:
```bash
# Ejecutar pytest
pytest
```

---

## Notas de Desarrollo y Buenas Prácticas
- **Asincronía:** Todas las operaciones de base de datos (`MongoDB` con Motor) y subida de archivos deben definirse con `async def` y usar `await`.
- **Estructura limpia:** Evite la inyección de lógica de negocio o queries en los controladores o routers. Coloque toda la lógica en los `services` correspondientes y las llamadas a base de datos en los `repositories`.
- **Variables de Entorno:** Nunca suba el archivo `.env` a git. Mantenga la plantilla de referencia en `.env.example` actualizada si agrega nuevos parámetros.
