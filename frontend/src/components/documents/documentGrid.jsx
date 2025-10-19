import DocumentCard from './DocumentCard'
import '../../styles/documents/DocumentGrid.css'

function DocumentGrid({ documents, loading, error }) {
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
    <div className="library">
      {documents.map((doc) => (
        <DocumentCard key={doc._id || doc.id} document={doc} />
      ))}
    </div>
  )
}

export default DocumentGrid
