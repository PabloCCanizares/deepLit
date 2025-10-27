# 🚀 deepLit Frontend

---

## ✨ Características

- 🔐 **Autenticación JWT** - Login y registro con gestión de sesiones
- 📊 **Dashboard interactivo** - Visualización de estadísticas
- 🎨 **Diseño moderno** - Tema personalizado morado/violeta (aun por definir paleta de colores, de momento prototipo)
- 📱 **Responsive** - Adaptado a móviles y tablets
- 🛡️ **Rutas protegidas** - Sistema de autenticación con `AuthContext`
- ⚡ **Vite** - Build ultrarrápido
- 🧹 **Código limpio** - Sin código innecesario, solo lo esencial

---

## 🏗️ Estado del Proyecto

**Versión inicial funcional** con arquitectura base para escalar:

### **Implementado:**
- ✅ Sistema de autenticación completo (Login/Register)
- ✅ Dashboard con estadísticas (conectado a `/stats` del backend pero sin implementar en el backend)
- ✅ Layout responsive con Navbar y Sidebar
- ✅ Manejo de errores estandarizado
- ✅ Context API para autenticación global

### **Por implementar:**
- 📝 Gestión de documentos
- 📤 Subida de archivos
- 🔍 Búsqueda y filtrado
- ⚙️ Configuración de usuario

---

## 📋 Requisitos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 (o yarn >= 1.22.0)
- **Backend FastAPI** corriendo en `http://localhost:8000`

---

## 🚀 Instalación

### **1. Instalar dependencias**

```bash
cd frontend
npm install
```

### **2. Iniciar servidor de desarrollo**

```bash
npm run dev
```

El frontend estará disponible en: **http://localhost:3000**

---

## 📜 Scripts Disponibles

```bash
# Desarrollo (con hot reload)
npm run dev

# Build para producción
npm run build

# Preview del build de producción
npm run preview

# Linter (detectar errores)
npm run lint
```

---

## 🗂️ Estructura del Proyecto

```
frontend/
├── index.html              # Punto de entrada HTML (raíz en Vite)
├── public/
│   └── favicon.svg         # Favicon personalizado
├── src/
│   ├── main.jsx            # Punto de entrada de React
│   ├── App.jsx             # Componente principal con rutas
│   │
│   ├── api/
│   │   └── api.js          # Centralización de llamadas API
│   │
│   ├── context/
│   │   └── AuthContext.jsx # Estado global de autenticación
│   │
│   ├── pages/
│   │   ├── Login.jsx       # Página de login
│   │   ├── Register.jsx    # Página de registro
│   │   └── Dashboard.jsx   # Dashboard principal
│   │
│   ├── components/
│   │   ├── Auth/
│   │   │   └── PrivateRoute.jsx  # Protección de rutas
│   │   ├── layout/
│   │   │   ├── Layout.jsx        # Layout con Navbar + Sidebar
│   │   │   ├── Navbar.jsx        # Barra de navegación superior
│   │   │   └── Sidebar.jsx       # Menú lateral
│   │   └── dashboard/
│   │       ├── StatCard.jsx      # Tarjeta de estadística
│   │       ├── YearChart.jsx     # Gráfico de años
│   │       └── KeywordRanking.jsx # Ranking de keywords
│   │
│   └── styles/
│       ├── App.css         # Estilos globales y del dashboard
│       └── Auth.css        # Estilos de login/register
│
├── vite.config.js          # Configuración de Vite
├── package.json            # Dependencias y scripts
└── .eslintrc.cjs           # Configuración de ESLint
```

---

## 🔌 Integración con Backend

### **Proxy de Vite (desarrollo):**

```javascript
// vite.config.js
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

**Funcionamiento:**
- Frontend llama a: `/api/auth/login`
- Vite redirige a: `http://localhost:8000/auth/login`
- ✅ Sin problemas de CORS en desarrollo

### **API Base:**

```javascript
// src/api/api.js
const API_BASE = '/api';  // En desarrollo usa el proxy de Vite

// Endpoints
authAPI.login(email, password)      // POST /api/auth/login
authAPI.register(email, pass, name) // POST /api/auth/register
authAPI.getMe()                      // GET /api/auth/me
authAPI.logout()                     // POST /api/auth/logout
statsAPI.getStats()                  // GET /api/stats
```

---

## 🔐 Sistema de Autenticación

### **Flujo completo:**

```
1. Usuario → Register/Login
2. Backend → Devuelve token JWT
3. Frontend → Guarda token en localStorage
4. Frontend → Incluye token en todas las peticiones (Authorization: Bearer <token>)
5. PrivateRoute → Verifica token antes de mostrar rutas protegidas
```

### **AuthContext:**

Proporciona estado global de autenticación:

```javascript
import { useAuth } from './context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // user: { email, name }
  // isAuthenticated: true/false
}
```

### **PrivateRoute:**

Protege rutas que requieren autenticación:

```javascript
<Route path="/" element={
  <PrivateRoute>
    <Layout />
  </PrivateRoute>
}>
  <Route path="dashboard" element={<Dashboard />} />
</Route>
```

---

## 🎨 Estilos

### **Variables CSS:**

```css
:root {
  --color-black: #0f0817;
  --color-violet-dark: #1e1232;
  --color-violet-light: #dcc2ff;
  --color-violet-medium: #8a5cf6;
  --color-white: #ffffff;
  --color-gray: #6b7280;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
}
```

### **Archivos de estilos:**

- **`App.css`** - Estilos globales, layout, dashboard, navbar, sidebar
- **`Auth.css`** - Estilos específicos de login y register

---

## 🌐 Rutas de la Aplicación

| Ruta | Componente | Protegida | Descripción |
|------|------------|-----------|-------------|
| `/login` | Login | ❌ No | Inicio de sesión |
| `/register` | Register | ❌ No | Registro de usuario |
| `/dashboard` | Dashboard | ✅ Sí | Panel principal |
| `/` | - | ✅ Sí | Redirige a `/dashboard` |
| `*` | - | - | Redirige a `/login` |

---

## 📦 Dependencias Principales

```json
{
  "react": "^18.3.1",           // Framework UI
  "react-dom": "^18.3.1",       // React para web
  "react-router-dom": "^6.22.3", // Routing
  "chart.js": "^4.4.2",         // Gráficos
  "react-chartjs-2": "^5.2.0",  // React wrapper para Chart.js
  "vite": "^5.2.0"              // Build tool
}
```

---

## 🚀 Build para Producción

### **1. Generar build:**

```bash
npm run build
```

**Output:**
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js   # Código compilado
│   └── index-[hash].css  # Estilos compilados
└── favicon.svg
```

### **2. Desplegar:**

#### **Opción A: Mismo dominio con backend (Nginx)**

```nginx
server {
    listen 80;
    server_name deeplit.com;

    # Frontend (archivos estáticos)
    location / {
        root /var/www/deeplit/frontend/dist;
        try_files $uri /index.html;
    }

    # Backend (proxy)
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
    }
}
```

**No necesitas `.env`** porque el proxy de Nginx maneja `/api` igual que Vite en desarrollo.

---

#### **Opción B: Dominios diferentes**

Si el backend está en `https://api.deeplit.com`:

**1. Crear `.env.production`:**
```env
VITE_API_URL=https://api.deeplit.com
```

**2. Build:**
```bash
npm run build  # Lee .env.production automáticamente
```

**3. Desplegar `dist/` a tu servidor.**

---

## 🐛 Debugging

### **Ver logs en consola:**

Los errores se muestran automáticamente en las DevTools del navegador.

### **Errores comunes:**

#### **Error: "No se puede conectar al servidor"**
→ Backend no está corriendo en `localhost:8000`
```bash
# Inicia el backend:
cd backend
python -m uvicorn app.main:app --reload
```

#### **Error: "Token inválido"**
→ Token expirado o backend reiniciado
```bash
# Solución: Vuelve a hacer login
```

#### **Error 404 en `/stats`**
→ Endpoint no existe aún en el backend (normal en desarrollo inicial)

---

## 🔧 Configuración Adicional

### **Cambiar puerto de desarrollo:**

```javascript
// vite.config.js
server: {
  port: 3001,  // Cambia de 3000 a 3001
}
```

### **Añadir nueva ruta:**

**1. Crear página:**
```javascript
// src/pages/Documents.jsx
function Documents() {
  return <h1>Documentos</h1>;
}
export default Documents;
```

**2. Añadir a rutas:**
```javascript
// src/App.jsx
import Documents from './pages/Documents';

<Route path="documents" element={<Documents />} />
```

**3. Añadir a Sidebar:**
```javascript
// src/components/layout/Sidebar.jsx
<Link to="/documents" className="sidebar-link">
  <i className="fas fa-book"></i>
  <span>Documentos</span>
</Link>
```

---

## 🤝 Contribuir

Al agregar nuevas funcionalidades:

1. ✅ Mantén la estructura de carpetas
2. ✅ Usa `AuthContext` para acceder al usuario
3. ✅ Todas las llamadas API van en `src/api/api.js`
4. ✅ Los errores del backend siempre tienen formato `StandardResponse`
5. ✅ Usa componentes reutilizables cuando sea posible
6. ✅ Mantén los estilos en `App.css` (global) o archivos específicos

---

## 📝 Notas

- **Proxy de Vite:** Solo funciona en desarrollo, no en producción
- **localStorage:** Se usa para persistir el token JWT
- **React Router:** Usa `<Link>` en vez de `<a>` para navegación interna
- **Hot Reload:** Los cambios se reflejan automáticamente sin recargar
- **ESLint:** Detecta errores mientras escribes código

---

## ✅ Estado del Código

- ✅ Sin código duplicado
- ✅ Errores estandarizados con el backend
- ✅ Solo 2 archivos CSS (App.css + Auth.css)
- ✅ Componentes simples y reutilizables
- ✅ Preparado para escalar

