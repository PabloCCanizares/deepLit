import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

function Navbar({ toggleSidebar }) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    // No necesitamos redirigir manualmente - PrivateRoute lo hará automáticamente
    // cuando detecte que user === null
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <button 
          className="sidebar-toggle" 
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <i className="fas fa-bars"></i>
        </button>

        <Link to="/" className="navbar-brand">
          <strong>deepLit</strong>
        </Link>

        <div className="navbar-menu">
          {/* User menu */}
          <div className="user-menu">
            <button 
              className="user-button"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <i className="fas fa-user-circle"></i>
              <span>{user?.name || user?.email || 'Usuario'}</span>
              <i className="fas fa-chevron-down"></i>
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-info">
                  <strong>{user?.name || 'Usuario'}</strong>
                  <small>{user?.email}</small>
                </div>
                <hr />
                <button onClick={handleLogout} className="logout-button">
                  <i className="fas fa-sign-out-alt"></i>
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar


