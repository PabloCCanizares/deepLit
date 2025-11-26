import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { collectionsAPI } from '../../api/api'
import '../../styles/collections/CollectionCard.css'

function CollectionCard({ collection, onEdit }) {
  const [showMenu, setShowMenu] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const menuRef = useRef(null)
  const cardRef = useRef(null)
  const name = collection.name || 'Sin título'
  const description = collection.description || 'Sin descripción'
  const articleCount = collection.article_count || 0
  const color = collection.color || '#3B82F6'
  const id = collection._id || collection.id

  // Intersection Observer: detectar cuando el card es visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect() // Solo necesitamos detectar una vez
        }
      },
      { 
        rootMargin: '100px', // Cargar un poco antes de que sea visible
        threshold: 0.1 
      }
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Cargar imagen solo cuando el card es visible
  useEffect(() => {
    if (!isVisible || !collection.image_url || imageUrl || imageLoading) return

    setImageLoading(true)
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
      .finally(() => {
        setImageLoading(false)
      })
    
    // Cleanup blob URL on unmount
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [isVisible, collection.image_url, id])

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
      <div className="collection-card" ref={cardRef}>
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
          {imageLoading ? (
            <div className="collection-placeholder">
              <i className="fas fa-spinner fa-spin"></i>
            </div>
          ) : (imageUrl && !imageError) ? (
            <img 
              src={imageUrl} 
              alt={name}
              className="collection-cover-image"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="collection-placeholder">
              <i className="fas fa-folder"></i>
            </div>
          )}
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
