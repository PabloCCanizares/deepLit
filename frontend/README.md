# deepLit Frontend - Interfaz de Usuario (React + Vite)

[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![CSS3](https://img.shields.io/badge/CSS-Vanilla-1572B6.svg?style=flat-square&logo=css3&logoColor=white)](https://w3.org/Style/CSS/)
[![Chart.js](https://img.shields.io/badge/Chart.js-4-FF6384.svg?style=flat-square&logo=chartdotjs&logoColor=white)](https://www.chartjs.org)

La interfaz web de deepLit es una Single Page Application (SPA) moderna, rápida e interactiva construida con React y Vite. Está diseñada específicamente para optimizar la experiencia de lectura, clasificación, síntesis y redacción científica a través de un diseño responsivo y sofisticados flujos de trabajo guiados por inteligencia artificial.

---

## Características de la Interfaz

- **Dashboard Analítico:** Dashboard con tarjetas estadísticas de artículos agregados, gráficos de distribución temporal y clasificaciones temáticas automáticas.
- **Grafo de Conocimiento Interactivo:** Visualización tridimensional e interactiva del grafo de relaciones (autores, artículos, palabras clave) conectado directamente con Neo4j.
- **Espacio de Trabajo de Revisión Sistemática (Review Workflow):**
  - **Screening (Cribado):** Interfaz para clasificar artículos como incluidos, excluidos o dudosos, con apoyo de sugerencias de IA.
  - **Clustering:** Agrupamiento de documentos en clústeres temáticos.
  - **Evidence Extraction:** Configuración y visualización de tablas de extracción de evidencias.
  - **Collection Synthesis:** Generador interactivo de reportes de síntesis de colecciones por IA.
  - **Scientific Writing:** Copiloto inteligente para redactar párrafos y secciones académicas basadas en las evidencias del repositorio.
- **Búsqueda e Importación con OpenAlex:** Consulta directa del catálogo mundial OpenAlex con importación en un clic a la biblioteca local de deepLit.
- **Gestión de Colecciones y Biblioteca:** Vistas en lista y rejilla de artículos locales, descarga de PDFs, edición de metadatos y categorización en carpetas personalizadas.
- **Gestión de Sesiones:** Autenticación JWT persistente en `localStorage`, con control global en `AuthContext` y protección de rutas privadas.
- **Diseño Rápido:** Compilado optimizado con Vite, carga modular y estilos fluidos usando Vanilla CSS.

---

## Estructura del Proyecto

El código está estructurado para facilitar la escalabilidad y reutilización de componentes:

```
frontend/
├── index.html              # Archivo de entrada HTML de Vite
├── public/                 # Recursos estáticos públicos (favicons, imágenes)
├── src/
│   ├── Main.jsx            # Punto de entrada de React / DOM
│   ├── App.jsx             # Enrutador principal (React Router DOM) y providers
│   │
│   ├── api/
│   │   └── api.js          # Centralización e interceptación de llamadas HTTP (fetch/axios)
│   │
│   ├── context/            # Proveedores de estado global (Context API)
│   │   ├── AuthContext.jsx       # Sesiones y credenciales de usuario
│   │   ├── ThemeContext.jsx      # Control del tema (Claro / Oscuro)
│   │   └── CollectionContext.jsx # Colección activa seleccionada en la app
│   │
│   ├── components/         # Componentes modulares y reutilizables
│   │   ├── auth/           # Rutas protegidas (PrivateRoute)
│   │   ├── layout/         # Estructura visual (Layout, Sidebar, Navbar)
│   │   ├── dashboard/      # Tarjetas y gráficos del panel
│   │   └── documents/      # Controles, vistas en lista y rejillas de artículos
│   │
│   ├── pages/              # Páginas completas (Vistas) de la aplicación
│   │   ├── PublicLanding.jsx     # Página de inicio para usuarios públicos
│   │   ├── Login.jsx             # Formulario de inicio de sesión
│   │   ├── Register.jsx          # Formulario de registro de cuenta
│   │   ├── Dashboard.jsx         # Panel de estadísticas principal
│   │   ├── KnowledgeGraph.jsx    # Visualización interactiva del grafo Neo4j
│   │   ├── Articles.jsx          # Biblioteca de artículos (subida y filtros)
│   │   ├── ArticleView.jsx       # Vista detallada de un paper (PDF y metadatos)
│   │   ├── ArticleEdit.jsx       # Formulario para editar metadatos de artículos
│   │   ├── Collections.jsx       # Listado de carpetas/colecciones temáticas
│   │   ├── CollectionDetail.jsx  # Vista de artículos dentro de una colección
│   │   ├── CollectionArticles.jsx# Buscador enfocado de artículos
│   │   ├── ReviewWorkflow.jsx    # Flujo sistemático paso a paso (AI agents workspace)
│   │   ├── OpenAlex.jsx          # Buscador de OpenAlex
│   │   ├── OpenAlexView.jsx      # Detalle de metadatos de OpenAlex antes de importar
│   │   ├── Profile.jsx           # Perfil y preferencias del usuario
│   │   └── PublicPreview.jsx     # Vista pública compartida de documentos
│   │
│   └── styles/             # Hojas de estilo estructuradas por módulos
│       ├── App.css         # Archivo global de importaciones CSS
│       ├── Auth.css        # Estilos de Login y Registro
│       ├── components/     # CSS de componentes visuales compartidos
│       ├── dashboard/      # CSS de gráficos y widgets
│       ├── layout/         # CSS de barras de navegación y Sidebar
│       └── profile/        # CSS del perfil de usuario
│
├── vite.config.js          # Configuración de Vite (servidor y proxy de desarrollo)
├── package.json            # Scripts de ejecución y librerías externas
└── .eslintrc.cjs           # Configuración de reglas de linter y calidad de código
```

---

## Instalación y Desarrollo

### Requisitos Previos
- Node.js >= 18.0.0
- npm >= 9.0.0
- El backend de FastAPI en ejecución (por defecto en `http://localhost:8000`)

### Pasos para Ejecutar

1. **Instalar dependencias:**
   ```bash
   cd frontend
   npm install
   ```

2. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

3. **Abrir en el navegador:**
   La aplicación estará disponible en la dirección: **`http://localhost:3000`**

---

## Configuración del Servidor y Proxy de Vite

Durante la fase de desarrollo, Vite incluye un servidor proxy para redirigir las peticiones `/api` al backend sin toparse con problemas de CORS en el navegador:

```javascript
// vite.config.js
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

Esto significa que cuando el frontend llama a `/api/auth/login`, Vite redirige transparentemente la llamada a `http://localhost:8000/auth/login`.

---

## Scripts Disponibles

En el directorio del frontend puedes ejecutar:

```bash
# Iniciar servidor local en modo desarrollo
npm run dev

# Compilar la aplicación para producción
npm run build

# Previsualizar de manera local el build de producción generado
npm run preview

# Ejecutar el linter para detectar advertencias o errores en el código
npm run lint
```

---

## Dependencias Clave

- **react** & **react-dom** (^18.3.1): Biblioteca principal para interfaces.
- **react-router-dom** (^6.22.3): Gestión de enrutamiento del lado del cliente.
- **chart.js** & **react-chartjs-2**: Renderizado de gráficos en el Dashboard.
- **@tanstack/react-query** (^5.90.11): Sincronización y caché de datos del servidor.
- **vite** (^5.2.0): Servidor de desarrollo y empaquetador ultrarrápido.
