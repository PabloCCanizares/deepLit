import { Link, useLocation } from 'react-router-dom'
import '../../styles/App.css'

function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  return (
    <>
      {/* Overlay */}
      <div 
        className={`sidebarOverlay ${isOpen ? 'visible' : ''}`} 
        onClick={onClose}
      ></div>
      
      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebarHeader">
          <h2 className="sidebarTitle">Menú</h2>
          <button className="sidebarClose" onClick={onClose} aria-label="Cerrar">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <nav className="sidebarNav">
          {/* Principal */}
          <Link 
            to="/dashboard" 
            className={`sidebarLink ${location.pathname === '/dashboard' ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="fas fa-chart-line"></i>
            <span>Dashboard</span>
          </Link>

          {/* Documentos */}
          <div className="sidebarGroup">
            <div className="sidebarGroupTitle">Documentos</div>
            <Link 
              to="/documents" 
              className={`sidebarLink ${location.pathname === '/documents' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-file-alt"></i>
              <span>Mis Documentos</span>
            </Link>
            <Link 
              to="/upload" 
              className={`sidebarLink ${location.pathname === '/upload' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-cloud-upload-alt"></i>
              <span>Subir Documentos</span>
            </Link>
          </div>

          {/* Búsqueda y Análisis */}
          <div className="sidebarGroup">
            <div className="sidebarGroupTitle">Búsqueda y Análisis</div>
            <Link 
              to="/search" 
              className={`sidebarLink ${location.pathname === '/search' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-search"></i>
              <span>Búsqueda</span>
            </Link>
            <Link 
              to="/scholar" 
              className={`sidebarLink ${location.pathname === '/scholar' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-graduation-cap"></i>
              <span>Scholar</span>
            </Link>
          </div>

          {/* Configuración */}
          <div className="sidebarGroup">
            <div className="sidebarGroupTitle">Configuración</div>
            <Link 
              to="/profile" 
              className={`sidebarLink ${location.pathname === '/profile' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-user-cog"></i>
              <span>Perfil</span>
            </Link>
            <Link 
              to="/settings" 
              className={`sidebarLink ${location.pathname === '/settings' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-cog"></i>
              <span>Ajustes</span>
            </Link>
          </div>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar


