import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useCollection } from "../../context/CollectionContext";
import AiAssistant from '../ai_assistant/AiAssistant'
import '../../styles/App.css'
import { useLocation } from 'react-router-dom';


function Navbar({ toggleSidebar }) {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const collectionMenuRef = useRef(null);
  const { collections, selectedCollectionId, changeCollection  } = useCollection();
  const location = useLocation();


  useEffect(() => {
    function handleClickOutside(event) {
      if (collectionMenuRef.current && !collectionMenuRef.current.contains(event.target)) {
        setShowCollectionMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCollectionChange = (collectionId) => {
    changeCollection(collectionId);
    setShowCollectionMenu(false);
  };

  const handleLogout = () => {
    setShowCollectionMenu(false);
    logout();
  };

  const isCollectionButtonEnabled = [
    "/search",
    "/openalex",
    "/dashboard"
  ].includes(location.pathname);

  
  const selectedCollection = collections.find(c => c._id === selectedCollectionId);
  const scopeLabel = selectedCollection ? selectedCollection.name : 'Toda la biblioteca'

  return (
    <>
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
              className={`collectionButton ${!isCollectionButtonEnabled ? 'disabled' : ''}`}
              onClick={() => {
                if (isCollectionButtonEnabled) {
                  setShowCollectionMenu(!showCollectionMenu)
                }
              }}
            >
              <span>{scopeLabel}</span>
              <i className="fas fa-chevron-down"></i>
            </button>
            
            {showCollectionMenu && (
              <div className="collectionDropdown">
                <button
                  className={`collectionOption ${!selectedCollectionId ? 'active' : ''}`}
                  onClick={() => handleCollectionChange('')}
                >
                  <i className="fas fa-list"></i>
                  <span>Toda la biblioteca</span>
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
              title="Modo claro"
            >
              <i className="fas fa-sun"></i>
            </button>
            <button
              className={`themeButton ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => theme !== 'dark' && toggleTheme()}
              title="Modo oscuro"
            >
              <i className="fas fa-moon"></i>
            </button>
          </div>

          <AiAssistant />

          <div className="navbarActions">
            <Link to="/profile" className="navIconButton" title="Perfil" aria-label="Perfil">
              <i className="fas fa-user"></i>
            </Link>
            <button
              type="button"
              className="navLogoutButton"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Cerrar sesión</span>
            </button>
          </div>

          </div>
        </div>
      </nav>

    </>
  )
}

export default Navbar
