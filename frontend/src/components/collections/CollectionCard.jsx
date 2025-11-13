import { Link } from 'react-router-dom'
import '../../styles/collections/CollectionCard.css'

function CollectionCard({ collection }) {
  const name = collection.name || 'Sin título'
  const category = collection.category || 'Sin categoría'
  const articleCount = collection.articles?.length || 0
  const image = collection.image || null
  const id = collection._id || collection.id

  return (
    <div className="collection-card">
      <Link to={`/collections/${id}`} className="collection-cover-link">
        <div className="collection-cover">
          {image ? (
            <img src={image} alt={name} className="collection-image" />
          ) : (
            <div className="collection-placeholder">
              <i className="fas fa-folder"></i>
            </div>
          )}
        </div>
      </Link>
      <div className="collection-info">
        <div className="collection-name" title={name}>
          <strong>Nombre:</strong> {name}
        </div>
        <div className="collection-category">
          <strong>Categoría:</strong> {category}
        </div>
        <div className="collection-articles">
          <strong>Artículos:</strong> {articleCount}
        </div>
      </div>
    </div>
  )
}

export default CollectionCard
