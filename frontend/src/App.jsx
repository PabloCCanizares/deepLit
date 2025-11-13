import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/auth/PrivateRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Articles from './pages/Articles'
import ArticleView from './pages/ArticleView'
import ArticleEdit from './pages/ArticleEdit'
import Collections from './pages/Collections'
import History from './pages/History'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Explore from './pages/Explore'
import OpenAlex from './pages/OpenAlex'
import OpenAlexView from './pages/OpenAlexView'


function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Rutas públicas (sin autenticación) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rutas protegidas (requieren autenticación) */}
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="articles" element={<Articles />} />
            <Route path="articles/:id" element={<ArticleView />} />
            <Route path="articles/:id/edit" element={<ArticleEdit />} />
            <Route path="collections" element={<Collections />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="search" element={<Articles />} />
            <Route path="openalex" element={<OpenAlex />} />
            <Route path="openalex/:id" element={<OpenAlexView />} />
            {/* Legacy routes - redirect to new ones */}
            <Route path="inicio" element={<Navigate to="/dashboard" replace />} />
            <Route path="explorar" element={<Navigate to="/" replace />} />
            <Route path="colecciones" element={<Navigate to="/" replace />} />
            <Route path="historial" element={<Navigate to="/articles" replace />} />
            <Route path="perfil" element={<Navigate to="/profile" replace />} />
            <Route path="configuracion" element={<Navigate to="/settings" replace />} />
          </Route>
          
          {/* Ruta por defecto - redirigir a login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App


