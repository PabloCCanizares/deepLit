import { Link } from 'react-router-dom'
import '../../styles/collections/CollectionCard.css'

function CollectionCard({ collection }) {
  const name = collection.name || 'Sin título'
  const description = collection.description || 'Sin descripción'
  const articleCount = collection.article_count || 0
  const color = collection.color || '#3B82F6'
  const id = collection._id || collection.id

  return (
    <Link to={`/collections/${id}`} className="collection-card-link">
      <div className="collection-card">
        <div 
          className="collection-cover"
          style={{ backgroundColor: color }}
        >
          <div className="collection-placeholder">
            <i className="fas fa-folder"></i>
          </div>
        </div>
        <div className="collection-info">
          <div className="collection-name" title={name}>
            <strong>Nombre:</strong> {name}
          </div>
          <div className="collection-description" title={description}>
            <strong>Descripción:</strong> {description}
          </div>
          <div className="collection-articles">
            <strong>Artículos:</strong> {articleCount}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default CollectionCard
