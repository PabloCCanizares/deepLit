import { Link } from 'react-router-dom'
import '../../styles/documents/DocumentCard.css'

function DocumentCard({ document, baseRoute = '/documents' }) {
  const title = document.title || '-' //FIXME Cambiar por Untitled?
  const category = document.category || '-'
  const pages = document.pages || '-'
  const year = document.year || '-'
  const id = document._id || document.id
  
  // Codificar el ID para usar en la URL (especialmente para IDs de OpenAlex que son URLs)
  const encodedId = encodeURIComponent(id)

  return (
    <div className="lib-item">
      <Link to={`${baseRoute}/${encodedId}`} className="lib-cover-link">
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
          <Link to={`${baseRoute}/${encodedId}/edit`} title="Editar">
            <i className="fas fa-edit"></i> Editar
          </Link>
        </div>
      </div>
    </div>
  )
}

export default DocumentCard
