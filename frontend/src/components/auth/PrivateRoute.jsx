import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Componente para proteger rutas que requieren autenticación
 * 
 * Si el usuario NO está autenticado, redirige a /login
 * Si está autenticado, muestra el contenido
 */
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Mientras verifica el token, mostrar loading
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
        color: '#666'
      }}>
        <div>
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado, mostrar el contenido
  return children;
}

export default PrivateRoute;

