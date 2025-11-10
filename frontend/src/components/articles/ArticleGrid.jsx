import ArticleCard from './ArticleCard'
import '../../styles/articles/ArticleGrid.css'

function ArticleGrid({ documents, loading, error, baseRoute = '/articles' }) {
  if (loading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--main_color)' }}></i>
        <p>Cargando artículos...</p>
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
        <p>No hay artículos disponibles</p>
      </div>
    )
  }

  return (
    <div className="library">
      {documents.map((doc) => (
        <ArticleCard key={doc._id || doc.id} document={doc} baseRoute={baseRoute} />
      ))}
    </div>
  )
}

export default ArticleGrid
