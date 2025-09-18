deepLit/
├── app.py
├── config.py
├── extensions.py
├── utils.py
├── routes/
│   ├── __init__.py
│   ├── documents.py
│   ├── completion_queue.py
│   ├── config_routes.py
│   ├── scholar.py
│   └── uploads.py
├── templates/
│   ├── base.html
│   ├── dashboard.html
│   ├── home.html
│   ├── upload.html
│   ├── result.html
│   ├── config.html
│   ├── scholar_results.html
│   ├── result_excel.html
│   ├── upload_folder.html
│   └── upload_excel.html
└── static/
    ├── css/
    └── js/
---------------------------
El archivo app.py es el punto de entrada principal de la aplicación Flask. Resume la configuración y el arranque de la web al realizar las siguientes tareas:

Inicialización de la aplicación: Se crea la instancia de Flask.
Configuración: Se carga la configuración a partir de la clase Config ubicada en config.py.
Inicialización de extensiones: Se inicia la extensión mongo para la conexión a la base de datos.
Registro de Blueprints: Se integran tres módulos de rutas:
documents_bp para las rutas de documentos.
config_bp para las rutas de configuración.
scholar_bp para las rutas de búsqueda en Scholar.
Ejecución del servidor: Se arranca la aplicación en modo debug en el puerto 5001.

---------------------------
El archivo `routes/config_routes.py` define un blueprint que gestiona la configuración de la aplicación a través de varios endpoints. En él se realizan las siguientes tareas:

Ruta /config:
GET: Recupera la configuración actual desde MongoDB y obtiene una muestra de documento para listar los campos disponibles (excluyendo _id y upload_date), y renderiza la plantilla config.html con estos datos.
POST: Recoge la configuración enviada mediante un formulario (como el ordenamiento por año y los campos requeridos) y actualiza el documento de configuración en la base de datos, mostrando un mensaje de éxito.
Ruta /save_config:
Procesa peticiones JSON para actualizar los campos requeridos de la configuración, reemplazando el documento en MongoDB.
Ruta /save_sort_order:
Permite actualizar el orden de clasificación (por ejemplo, ascendente o descendente) mediante una petición JSON, actualizando el valor correspondiente en la configuración.
---------------------------
El archivo routes/documents.py implementa la lógica de gestión y visualización de documentos científicos ya procesados. Entre sus responsabilidades se encuentran:

Visualización y administración de documentos:
Home: La ruta (/home) carga la configuración, obtiene todos los documentos, los ordena según el año (ascendente o descendente según la configuración) y separa aquellos con años válidos de los que no lo tienen, renderizando la plantilla home.html.
Detalle de documento: La ruta (/result/<id>) muestra la información completa de un documento seleccionado, formateando la fecha de subida a partir del ObjectId.
Búsqueda: La ruta (/search) permite buscar documentos por título utilizando expresiones regulares.
Gestión de la base de datos: Se incluye una ruta (/delete_all) para eliminar todos los documentos almacenados, facilitando la administración y pruebas de la aplicación.
---------------------------
El archivo `routes/scholar.py` se encarga de gestionar la búsqueda de publicaciones científicas utilizando dos fuentes distintas:

Búsqueda en Google Scholar:
La función search_google_scholar(query) emplea la librería scholarly para obtener resultados de publicaciones. Extrae y retorna detalles como título, autores, año, lugar de publicación, número de citas, resumen y URL de la publicación, asignando valores por defecto cuando algunos datos no están disponibles.
Búsqueda en Semantic Scholar:
La función search_semantic_scholar(query) realiza una petición HTTP a la API de Semantic Scholar. Procesa la respuesta para extraer campos similares (título, autores, año, venue, número de citas, abstract y URL) y retorna esta información en un diccionario.
Endpoint /scholar:
Se utiliza una consulta predeterminada ("Testing the untestable") para ejecutar ambas búsquedas y, a continuación, se renderiza la plantilla scholar_results.html con los resultados obtenidos de ambas fuentes.

---------------------------
El archivo `routes/dashboard.py` implementa la lógica del dashboard de la aplicación. Entre sus responsabilidades se encuentran:

Dashboard y estadísticas:
Recupera todos los documentos de la base de datos para calcular estadísticas clave (total de documentos, total de citas y promedio de citas).
Genera datos para un diagrama de barras agrupado por año, clasifica y ordena las palabras clave, y obtiene una lista de documentos recientes (formateando la fecha de subida).
Además, calcula notificaciones para la ausencia de abstract o keywords y genera una imagen de wordcloud para visualización.
Finalmente, renderiza la plantilla dashboard.html con toda esta información.

---------------------------
El archivo `routes/uploads.py` se encarga de gestionar la subida de archivos de forma separada. Entre sus responsabilidades se encuentran:

Carga y procesamiento de archivos:
Subida individual de PDF: Proporciona una página para subir un PDF (/upload_pdf_page) y un endpoint (/upload_pdf) que valida el archivo, lo guarda temporalmente, extrae metadatos (título, abstract, keywords, etc.) mediante funciones especializadas, inserta el documento en la base de datos y elimina el archivo temporal, renderizando el resultado.
Carga masiva de PDFs: La ruta (/upload_folder) permite subir varios archivos PDF, procesarlos de forma similar y mostrar un resumen de los documentos procesados.
Subida de Excel: El endpoint (/upload_excel) permite cargar un archivo Excel, valida que contenga las columnas requeridas, procesa cada fila para insertar los documentos en la base de datos y elimina el archivo temporal, mostrando los resultados en una plantilla específica.

---------------------------
El archivo `routes/completion queue` representa una cola de completado de campos:
Gestiona una cola de “completado de datos” para documentos con campos faltantes. Detecta qué documentos están incompletos según la configuración, los encola, lanza un worker en un hilo que consulta OpenAlex para encontrar el mejor “match” por similitud de título y actualiza el documento principal con los metadatos recuperados (solo si estaban vacíos), además de ofrecer vistas/JSON para monitorizar el proceso.
Responsabilidades principales
-Detección de incompletos: usando configuration.required_fields, identifica documentos con campos faltantes.
Gestión de cola: alta individual o múltiple, consulta del estado y listado de pendientes/encolados.
--Ejecución asíncrona: arranque/parada de un hilo daemon que procesa la cola en segundo plano.
Integración con OpenAlex: búsqueda por título, selección del mejor resultado por similitud (difflib) y actualización de campos en el documento.
Vistas de control: contador agregado (/queue), estado detallado (/queue/status) y vista intermedia de “matches” aplicados (/queue/intermediate).
