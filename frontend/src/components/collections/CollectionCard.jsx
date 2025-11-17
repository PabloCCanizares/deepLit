import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { collectionsAPI } from '../../api/api'
import '../../styles/collections/CollectionCard.css'

function CollectionCard({ collection, onEdit }) {
  const [showMenu, setShowMenu] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [imageError, setImageError] = useState(false)
  const menuRef = useRef(null)
  const name = collection.name || 'Sin título'
  const description = collection.description || 'Sin descripción'
  const articleCount = collection.article_count || 0
  const color = collection.color || '#3B82F6'
  const id = collection._id || collection.id

  // Load collection image if exists
  useEffect(() => {
    if (collection.image_url) {
      collectionsAPI.getImage(id)
        .then(blobUrl => {
          if (blobUrl) {
            setImageUrl(blobUrl)
          } else {
            setImageError(true)
          }
        })
        .catch(err => {
          console.error('Error loading collection image:', err)
          setImageError(true)
        })
    }
    
    // Cleanup blob URL on unmount
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [collection.image_url, id])

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleMenuToggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowMenu(!showMenu)
  }

  const handleEdit = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowMenu(false)
    if (onEdit) {
      onEdit(collection)
    }
  }

  return (
    <Link to={`/collections/${id}`} className="collection-card-link">
      <div className="collection-card">
        {/* Menú de 3 puntos */}
        <div className="collection-menu" ref={menuRef}>
          <button 
            className="menu-button"
            onClick={handleMenuToggle}
            title="Opciones"
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>
          {showMenu && (
            <div className="menu-dropdown">
              <button onClick={handleEdit}>
                <i className="fas fa-edit"></i>
                Editar
              </button>
            </div>
          )}
        </div>

        <div 
          className="collection-cover"
          style={{ backgroundColor: (imageUrl && !imageError) ? 'transparent' : color }}
        >
          {(imageUrl && !imageError) ? (
            <img 
              src={imageUrl} 
              alt={name}
              className="collection-cover-image"
              onError={() => setImageError(true)}
            />
          ) : null}
          <div className="collection-placeholder" style={{ display: (imageUrl && !imageError) ? 'none' : 'flex' }}>
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
