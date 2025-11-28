import { Link } from 'react-router-dom'
import '../../styles/articles/ArticleCard.css'

function ArticleCard({ document, baseRoute = '/articles', selectedArticles = [], onSelectArticle, onAddToCollectionsSingle, onDeleteArticle }) {
  const title = document.title || '-' //FIXME Cambiar por Untitled?
  const category = document.category || '-'
  const pages = document.pages || '-'
  const year = document.year || '-'
  const id = document._id || document.id
  const isSelected = selectedArticles.includes(id)
  
  // Codificar el ID para usar en la URL (especialmente para IDs de OpenAlex que son URLs)
  const encodedId = encodeURIComponent(id)

  const handleCheckboxClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onSelectArticle) {
      onSelectArticle(id)
    }
  }

  return (
    <div className={`lib-item ${isSelected ? 'selected' : ''}`}>
      {onSelectArticle && (
        <div className="article-checkbox" onClick={handleCheckboxClick}>
          <i className={`fas ${isSelected ? 'fa-check-square' : 'fa-square'}`}></i>
        </div>
      )}
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
          {onAddToCollectionsSingle && (
            <button
              className="card-action-btn"
              title="Añadir a colección(es)"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCollectionsSingle(id) }}
            >
              <i className="fas fa-folder-plus"></i>
            </button>
          )}

          {onDeleteArticle && (
            <button
              className="card-action-btn"
              title="Eliminar artículo"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteArticle(id) }}
            >
              <i className="fas fa-trash"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ArticleCard
