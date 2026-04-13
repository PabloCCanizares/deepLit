import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { CollectionProvider } from './context/CollectionContext'
import PrivateRoute from './components/auth/PrivateRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Articles from './pages/Articles'
import ArticleView from './pages/ArticleView'
import ArticleEdit from './pages/ArticleEdit'
import Collections from './pages/Collections'
import CollectionDetail from './pages/CollectionDetail'
import Profile from './pages/Profile'
import OpenAlex from './pages/OpenAlex'
import OpenAlexView from './pages/OpenAlexView'
import CollectionArticles from './pages/CollectionArticles'
import CollectionSynthesis from './pages/CollectionSynthesis'
import Screening from './pages/Screening'
import PublicPreview from './pages/PublicPreview'

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <CollectionProvider>
            <Routes>
              {/* Rutas publicas */}
              <Route path="/preview/*" element={<PublicPreview />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Rutas privadas */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                <Route path="articles" element={<Articles />} />
                <Route path="articles/:id" element={<ArticleView />} />
                <Route path="articles/:id/edit" element={<ArticleEdit />} />

                <Route path="collections" element={<Collections />} />
                <Route path="collections/:id" element={<CollectionDetail />} />

                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Navigate to="/profile" replace />} />

                <Route path="search" element={<CollectionArticles />} />
                <Route path="screening" element={<Screening />} />
                <Route path="collection-synthesis" element={<CollectionSynthesis />} />

                <Route path="openalex" element={<OpenAlex />} />
                <Route path="openalex/:id" element={<OpenAlexView />} />

                {/* Legacy */}
                <Route path="inicio" element={<Navigate to="/dashboard" replace />} />
                <Route path="explorar" element={<Navigate to="/" replace />} />
                <Route path="colecciones" element={<Navigate to="/" replace />} />
                <Route path="historial" element={<Navigate to="/articles" replace />} />
                <Route path="perfil" element={<Navigate to="/profile" replace />} />
                <Route path="configuracion" element={<Navigate to="/profile" replace />} />
              </Route>

              {/* Default route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CollectionProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App
