import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="private-route-loading" role="status" aria-live="polite">
        <div className="private-route-loading-card">
          <div className="private-route-animals" aria-hidden="true">
            <i className="fas fa-book-open"></i>
            <i className="fas fa-book"></i>
            <i className="fas fa-book-open"></i>
          </div>
          <div className="spinner private-route-spinner"></div>
          <p className="private-route-loading-text">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/preview" replace />
  }

  return children
}

export default PrivateRoute
