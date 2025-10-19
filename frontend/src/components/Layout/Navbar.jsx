import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../../styles/App.css'

function Navbar({ toggleSidebar }) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    // No necesitamos redirigir manualmente - PrivateRoute lo hará automáticamente
    // cuando detecte que user === null
  };

  return (
    <nav className="navbar">
      <div className="navbarContainer">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            className="sidebarToggle" 
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <i className="fas fa-bars"></i>
          </button>

          <Link to="/" className="navbarBrand">
            deepLit
          </Link>
        </div>

        <div className="navbarMenu">
          {/* User menu */}
          <div className="userMenu" ref={userMenuRef}>
            <button 
              className="userButton"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {user?.profileImage ? (
                <img 
                  src={user.profileImage} 
                  alt="Perfil"
                  className="userProfileImage"
                />
              ) : (
                <i className="fas fa-user-circle"></i>
              )}
              <span>{user?.name || user?.email || 'Usuario'}</span>
            </button>
            
            {showUserMenu && (
              <div className="userDropdown">
                <div className="userInfo">
                  {user?.profileImage && (
                    <img 
                      src={user.profileImage} 
                      alt="Perfil"
                      className="userDropdownImage"
                    />
                  )}
                  <div>
                    <strong>{user?.name || 'Usuario'}</strong>
                    <small>{user?.email}</small>
                  </div>
                </div>
                <hr />
                <Link to="/profile" className="profileLink">
                  <i className="fas fa-user-cog"></i>
                  Mi Perfil
                </Link>
                <button onClick={handleLogout} className="logoutButton">
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


