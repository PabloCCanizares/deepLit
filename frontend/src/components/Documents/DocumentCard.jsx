import { Link } from 'react-router-dom'
import '../../styles/documents/documentCard.css'

function DocumentCard({ document }) {
  const title = document.Title || document.title || '-'
  const category = document.Category || '-'
  const pages = document.Pag || '-'
  const year = document.Year || '-'
  const id = document._id || document.id

  return (
    <div className="lib-item">
      <Link to={`/documents/${id}`} className="lib-cover-link">
        <div className="lib-cover">
          <div className="lib-cover-overlay">
            <i className="fas fa-eye lib-cover-icon"></i>
          </div>
        </div>
      </Link>
      <div className="lib-meta">
        <div className="title-line" title={title}>
          <strong>Título:</strong> {title}
        </div>
        <div><strong>Categoría:</strong> {category}</div>
        <div><strong>Páginas:</strong> {pages}</div>
        <div><strong>Año:</strong> {year}</div>
        <div className="lib-edit-btn">
          <Link to={`/documents/${id}/edit`} title="Editar">
            <i className="fas fa-edit"></i> Editar
          </Link>
        </div>
      </div>
    </div>
  )
}

export default DocumentCard
