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

          {/* Artículos */}
          <div className="sidebarGroup">
            <div className="sidebarGroupTitle">Artículos</div>
            <Link 
              to="/articles" 
              className={`sidebarLink ${location.pathname === '/articles' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-file-alt"></i>
              <span>Biblioteca</span>
            </Link>
            <Link 
              to="/collections" 
              className={`sidebarLink ${location.pathname === '/collections' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-folder"></i>
              <span>Colecciones</span>
            </Link>
          </div>

          {/* Trabajo y Análisis */}
          <div className="sidebarGroup">
            <div className="sidebarGroupTitle">Trabajo y Análisis</div>
            <Link 
              to="/search" 
              className={`sidebarLink ${location.pathname === '/search' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-briefcase"></i>
              <span>Zona de Trabajo</span>
            </Link>
            <Link 
              to="/screening" 
              className={`sidebarLink ${location.pathname === '/screening' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-filter"></i>
              <span>Screening</span>
            </Link>
            <Link 
              to="/collection-synthesis" 
              className={`sidebarLink ${location.pathname === '/collection-synthesis' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-diagram-project"></i>
              <span>Collection Synthesis</span>
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
            <i className="fas fa-user"></i>
            <span>Perfil</span>
          </Link>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
