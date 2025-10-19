import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/auth/privateRoute'
import Layout from './components/layout/layout'
import Login from './pages/login'
import Register from './pages/register'
import Dashboard from './pages/dashboard'
import Home from './pages/home'
import Documents from './pages/documents'
import Collections from './pages/collections'
import History from './pages/history'
import Profile from './pages/profile'
import Settings from './pages/settings'
import Explore from './pages/explore'


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
            <Route path="inicio" element={<Home />} />
            <Route path="explorar" element={<Explore />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="documents" element={<Documents />} />
            <Route path="colecciones" element={<Collections />} />
            <Route path="historial" element={<History />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="configuracion" element={<Settings />} />
          </Route>
          
          {/* Ruta por defecto - redirigir a login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App


