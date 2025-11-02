import { Link } from 'react-router-dom'
import '../../styles/Documents/DocumentList.css'

function DocumentList({ documents, loading, error }) {
  if (loading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--color-violet-light)' }}></i>
        <p>Cargando documentos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <i className="fas fa-exclamation-circle" style={{ fontSize: '2rem', color: 'var(--color-danger)' }}></i>
        <p>{error}</p>
      </div>
    )
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="empty-container">
        <i className="fas fa-folder-open" style={{ fontSize: '2rem', color: 'var(--color-violet-light)' }}></i>
        <p>No hay documentos disponibles</p>
      </div>
    )
  }

  return (
    <div className="document-list">
      <div className="list-header">
        <div className="list-col-title">Título</div>
        <div className="list-col-category">Categoría</div>
        <div className="list-col-pages">Páginas</div>
        <div className="list-col-year">Año</div>
        <div className="list-col-actions">Opciones</div>
      </div>
      
      {documents.map((doc) => {
        const title = doc.title || '-' //FIXME Cambiar por Untitled?
        const category = doc.category || '-'
        const pages = doc.pages || '-'
        const year = doc.year || '-'
        const id = doc._id || doc.id

        return (
          <div key={id} className="list-row">
            <div className="list-col-title" title={title}>
              <i className="fas fa-file-alt list-icon"></i>
              <Link to={`/documents/${id}`} className="list-title-link">
                {title}
              </Link>
            </div>
            <div className="list-col-category">{category}</div>
            <div className="list-col-pages">{pages}</div>
            <div className="list-col-year">{year}</div>
            <div className="list-col-actions">
              <Link to={`/documents/${id}`} className="list-action-btn" title="Ver">
                <i className="fas fa-eye"></i>
              </Link>
              <Link to={`/documents/${id}/edit`} className="list-action-btn" title="Editar">
                <i className="fas fa-edit"></i>
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default DocumentList
