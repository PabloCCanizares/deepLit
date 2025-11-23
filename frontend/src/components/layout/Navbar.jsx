import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useCollection } from "../../context/CollectionContext";
import '../../styles/App.css'

function Navbar({ toggleSidebar }) {
  const { user, logout, profileImageUrl } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const userMenuRef = useRef(null);
  const collectionMenuRef = useRef(null);
  const { collections, selectedCollectionId, changeCollection  } = useCollection();

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (collectionMenuRef.current && !collectionMenuRef.current.contains(event.target)) {
        setShowCollectionMenu(false);
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

  const handleCollectionChange = (collectionId) => {
    changeCollection(collectionId);
    setShowCollectionMenu(false);
  };

  const selectedCollection = collections.find(c => c._id === selectedCollectionId);

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
            <span className="deepLit-d">deep</span><span className="deepLit-lit">Lit</span>
          </Link>
        </div>

        <div className="navbarMenu">
          {/* Collection selector*/}
          <div className="collectionSelector" ref={collectionMenuRef}>
            <button 
              className="collectionButton"
              onClick={() => setShowCollectionMenu(!showCollectionMenu)}
            >
              <span>{selectedCollection ? selectedCollection.name : 'Sin colección'}</span>
              <i className="fas fa-chevron-down"></i>
            </button>
            
            {showCollectionMenu && (
              <div className="collectionDropdown">
                <button
                  className={`collectionOption ${!selectedCollectionId ? 'active' : ''}`}
                  onClick={() => handleCollectionChange('')}
                >
                  <i className="fas fa-list"></i>
                  <span>Sin colección</span>
                </button>
                {collections.map(col => (
                  <button
                    key={col._id}
                    className={`collectionOption ${selectedCollectionId === col._id ? 'active' : ''}`}
                    onClick={() => handleCollectionChange(col._id)}
                  >
                    <i className="fas fa-folder"></i>
                    <span>{col.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>          
          {/* Theme toggle buttons */}
          <div className="themeToggle">
            <button 
              className={`themeButton ${theme === 'light' ? 'active' : ''}`}
              onClick={() => theme !== 'light' && toggleTheme()}
            >
              <i className="fas fa-sun"></i>
            </button>
            <button 
              className={`themeButton ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => theme !== 'dark' && toggleTheme()}
            >
              <i className="fas fa-moon"></i>
            </button>
          </div>

          {/* User menu */}
          <div className="userMenu" ref={userMenuRef}>
            <button 
              className="userButton"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {profileImageUrl ? (
                <img 
                  src={profileImageUrl} 
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
                  {profileImageUrl && (
                    <img 
                      src={profileImageUrl} 
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


