import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/auth/PrivateRoute'
import Layout from './components/layout/Layout'
import Login from './Pages/Login'
import Register from './Pages/Register'
import Dashboard from './Pages/Dashboard'
import Home from './Pages/Home'
import Documents from './Pages/Documents'
import DocumentView from './Pages/DocumentView'
import DocumentEdit from './Pages/DocumentEdit'
import Collections from './Pages/Collections'
import History from './Pages/History'
import Profile from './Pages/Profile'
import Settings from './Pages/Settings'
import Explore from './Pages/Explore'
import OpenAlex from './Pages/OpenAlex'


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
            <Route path="documents" element={<Documents />} />
            <Route path="documents/:id" element={<DocumentView />} />
            <Route path="documents/:id/edit" element={<DocumentEdit />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="search" element={<Documents />} />
            <Route path="openalex" element={<OpenAlex />} />
            <Route path="upload" element={<Documents />} />
            {/* Legacy routes - redirect to new ones */}
            <Route path="inicio" element={<Navigate to="/dashboard" replace />} />
            <Route path="explorar" element={<Navigate to="/" replace />} />
            <Route path="colecciones" element={<Navigate to="/" replace />} />
            <Route path="historial" element={<Navigate to="/documents" replace />} />
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


