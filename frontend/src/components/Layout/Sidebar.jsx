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
          <div className="deepLitLogo">
            <span className="deepLit-d">deep</span><span className="deepLit-lit">Lit</span>
          </div>
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
              to="/openalex" 
              className={`sidebarLink ${location.pathname === '/openalex' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-graduation-cap"></i>
              <span>OpenAlex</span>
            </Link>
          </div>
        </nav>

        {/* Configuración - Footer sin título */}
        <div className="sidebarFooter">
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
      </aside>
    </>
  )
}

export default Sidebar


