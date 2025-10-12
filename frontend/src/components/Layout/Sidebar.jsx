import { Link } from 'react-router-dom'

function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}
      
      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menú</h2>
          <button className="sidebar-close" onClick={onClose} aria-label="Cerrar">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="sidebar-link" onClick={onClose}>
            <i className="fas fa-home"></i>
            <span>Dashboard</span>
          </Link>
          
          {/* Más opciones se añadirán aquí */}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar


