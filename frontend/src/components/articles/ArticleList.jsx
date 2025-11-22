import { Link } from 'react-router-dom'
import '../../styles/articles/ArticleList.css'

function ArticleList({ documents, loading, error, baseRoute = '/articles', selectedArticles = [], onSelectArticle, onSelectAll }) {
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
    <div className="document-list">
      <div className="list-header">
        <div className="list-col-select">
          {onSelectArticle && (
            <div 
              className="article-checkbox-list header-checkbox" 
              onClick={onSelectAll}
              title={selectedArticles.length === documents.length && documents.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
            >
              <i className={`fas ${selectedArticles.length === documents.length && documents.length > 0 ? 'fa-check-square' : 'fa-square'}`}></i>
            </div>
          )}
        </div>
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
        const isSelected = selectedArticles.includes(id)
        
        // Codificar el ID para usar en la URL (especialmente para IDs de OpenAlex que son URLs)
        const encodedId = encodeURIComponent(id)

        return (
          <div key={id} className={`list-row ${isSelected ? 'selected' : ''}`}>
            <div className="list-col-select">
              {onSelectArticle && (
                <div 
                  className="article-checkbox-list" 
                  onClick={() => onSelectArticle(id)}
                >
                  <i className={`fas ${isSelected ? 'fa-check-square' : 'fa-square'}`}></i>
                </div>
              )}
            </div>
            <div className="list-col-title" title={title}>
              <i className="fas fa-file-alt list-icon"></i>
              <Link to={`${baseRoute}/${encodedId}`} className="list-title-link">
                {title}
              </Link>
            </div>
            <div className="list-col-category">{category}</div>
            <div className="list-col-pages">{pages}</div>
            <div className="list-col-year">{year}</div>
            <div className="list-col-actions">
              <Link to={`${baseRoute}/${encodedId}`} className="list-action-btn" title="Ver">
                <i className="fas fa-eye"></i>
              </Link>
              <button
                className="save-article-btn"
                title="Guardar artículo"
                onClick={() => handleSaveArticle(id)} // tu función para guardar
              >
                <i className="far fa-bookmark"></i>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ArticleList
