import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useCollection } from "../../context/CollectionContext";
import AiAssistant from '../ai_assistant/AiAssistant'
import '../../styles/App.css'
import { useLocation } from 'react-router-dom';


function Navbar({ toggleSidebar }) {
  const { theme, toggleTheme } = useTheme();
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const collectionMenuRef = useRef(null);
  const { collections, selectedCollectionId, changeCollection  } = useCollection();
  const location = useLocation();

  // Estado para modo offline/online
  const [offline, setOffline] = useState(() => {
    const saved = localStorage.getItem('ai_mode_offline')
    return saved === 'true' || saved === null // Por defecto true (offline)
  })

  // Guardar preferencia de modo AI y actualizar backend
  useEffect(() => {
    const updateBackendConfig = async () => {
      try {
        localStorage.setItem('ai_mode_offline', offline)
        // Actualizar el archivo de configuración runtime en el backend
        await fetch('/api/runtime-config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ offline })
        })
        console.log(`Modo AI actualizado: ${offline ? 'OFFLINE' : 'ONLINE'}`)
      } catch (error) {
        console.error('Error actualizando configuración:', error)
      }
    }

    updateBackendConfig()
  }, [offline])


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

  const isCollectionButtonEnabled = [
    "/search",
    "/openalex",
    "/dashboard"
  ].includes(location.pathname);

  
  const selectedCollection = collections.find(c => c._id === selectedCollectionId);

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

          {/* AI mode toggle buttons */}
          <div className="themeToggle">
            <button
              className={`themeButton ${offline ? 'active' : ''}`}
              onClick={() => setOffline(true)}
              title="Modo Offline (Ollama local)"
            >
              <i className="fas fa-desktop"></i>
            </button>
            <button
              className={`themeButton ${!offline ? 'active' : ''}`}
              onClick={() => setOffline(false)}
              title="Modo Online (Google Gemini)"
            >
              <i className="fas fa-cloud"></i>
            </button>
          </div>

          <AiAssistant />

          </div>
        </div>
      </nav>

    </>
  )
}

export default Navbar


