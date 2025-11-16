import { useState, useEffect } from 'react'
import { collectionsAPI } from '../../api/api'
import '../../styles/collections/AddToCollectionsModal.css'

function AddToCollectionsModal({ isOpen, onClose, selectedArticles = [], onSuccess }) {
  const [collections, setCollections] = useState([])
  const [selectedCollections, setSelectedCollections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadCollections()
      setSelectedCollections([])
    }
  }, [isOpen])

  const loadCollections = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await collectionsAPI.getAll()
      setCollections(response.data.collections || [])
    } catch (err) {
      setError(err.message || 'Error al cargar colecciones')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCollection = (collectionId) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(id => id !== collectionId)
      } else {
        return [...prev, collectionId]
      }
    })
  }

  const handleAddToCollections = async () => {
    if (selectedCollections.length === 0) {
      setError('Selecciona al menos una colección')
      return
    }

    try {
      setAdding(true)
      setError(null)

      // Añadir cada artículo a cada colección seleccionada
      const promises = []
      for (const collectionId of selectedCollections) {
        for (const articleId of selectedArticles) {
          promises.push(collectionsAPI.addArticle(collectionId, articleId))
        }
      }

      await Promise.all(promises)

      const totalAdded = selectedArticles.length * selectedCollections.length
      onSuccess && onSuccess(`${selectedArticles.length} artículo(s) añadido(s) a ${selectedCollections.length} colección(es)`)
      onClose()
    } catch (err) {
      setError(err.message || 'Error al añadir artículos a las colecciones')
    } finally {
      setAdding(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-to-collections-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <i className="fas fa-folder-plus"></i>
            {' '}Añadir a Colección(es)
          </h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Selecciona una o varias colecciones para añadir {selectedArticles.length} artículo(s)
          </p>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Cargando colecciones...</p>
            </div>
          ) : collections.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-folder-open"></i>
              <p>No tienes colecciones creadas</p>
              <p className="empty-hint">Crea una colección primero para poder añadir artículos</p>
            </div>
          ) : (
            <div className="collections-list">
              {collections.map(collection => (
                <div
                  key={collection._id}
                  className={`collection-item ${selectedCollections.includes(collection._id) ? 'selected' : ''}`}
                  onClick={() => handleToggleCollection(collection._id)}
                >
                  <div className="collection-checkbox">
                    <i className={`fas ${selectedCollections.includes(collection._id) ? 'fa-check-square' : 'fa-square'}`}></i>
                  </div>
                  <div 
                    className="collection-color" 
                    style={{ backgroundColor: collection.color || '#3B82F6' }}
                  ></div>
                  <div className="collection-info">
                    <h3 className="collection-name">{collection.name}</h3>
                    {collection.description && (
                      <p className="collection-description">{collection.description}</p>
                    )}
                    <span className="collection-count">
                      {collection.article_count || 0} artículo(s)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button 
            onClick={onClose} 
            className="btn-secondary"
            disabled={adding}
          >
            Cancelar
          </button>
          <button 
            onClick={handleAddToCollections} 
            className="btn-primary"
            disabled={adding || selectedCollections.length === 0 || loading}
          >
            {adding ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Añadiendo...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                Añadir a {selectedCollections.length} colección(es)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddToCollectionsModal
