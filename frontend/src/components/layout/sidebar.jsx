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
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <nav className="sidebarNav">
          {/* Título principal */}
          <div className="sidebarTitle">deepLit</div>
          <div className="sidebarTopSpacer"></div>

          {/* Inicio */}
          <Link 
            to="/inicio" 
            className={`sidebarLink ${location.pathname === '/inicio' ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="fas fa-house"></i>
            <span>Inicio</span>
          </Link>

          {/* Explorar */}
          <Link 
            to="/explorar" 
            className={`sidebarLink ${location.pathname === '/explorar' ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="fas fa-compass"></i>
            <span>Explorar</span>
          </Link>

          {/* Dashboard */}
          <Link 
            to="/dashboard" 
            className={`sidebarLink ${location.pathname === '/dashboard' ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="fas fa-gauge"></i>
            <span>Dashboard</span>
          </Link>

          {/* Colecciones */}
          <Link 
            to="/colecciones" 
            className={`sidebarLink ${location.pathname === '/colecciones' ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="fas fa-layer-group"></i>
            <span>Colecciones</span>
          </Link>

          {/* Documentos */}
          <Link 
            to="/documents" 
            className={`sidebarLink ${location.pathname === '/documents' ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="fas fa-file-lines"></i>
            <span>Documentos</span>
          </Link>

          {/* Historial */}
          <Link 
            to="/historial" 
            className={`sidebarLink ${location.pathname === '/historial' ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="fas fa-clock-rotate-left"></i>
            <span>Historial</span>
          </Link>

          {/* Spacer para empujar el footer al final */}
          <div className="sidebarSpacer"></div>

          {/* Footer con configuración y perfil */}
          <div className="sidebarFooter">
            <Link 
              to="/perfil" 
              className={`sidebarLink ${location.pathname === '/perfil' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-user"></i>
              <span>Perfil</span>
            </Link>
            <Link 
              to="/configuracion" 
              className={`sidebarLink ${location.pathname === '/configuracion' ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="fas fa-gear"></i>
              <span>Configuración</span>
            </Link>
          </div>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar


