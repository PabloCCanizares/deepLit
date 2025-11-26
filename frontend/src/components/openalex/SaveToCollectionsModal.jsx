import { useState, useEffect } from 'react'
import { collectionsAPI, openalexAPI, articlesAPI } from '../../api/api'
import '../../styles/openalex/SaveToCollectionsModal.css'

function SaveToCollectionsModal({ isOpen, onClose, articleId, onSuccess }) {
  const [collections, setCollections] = useState([])
  const [selectedCollections, setSelectedCollections] = useState([])
  const [alreadySavedIn, setAlreadySavedIn] = useState([]) // Colecciones donde ya está guardado
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && articleId) {
      loadData()
      setSelectedCollections([])
      setError(null)
    }
  }, [isOpen, articleId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Cargar colecciones y verificar si el artículo ya existe en paralelo
      const [collectionsRes, articleRes] = await Promise.allSettled([
        collectionsAPI.getAll(),
        articlesAPI.getById(articleId)
      ])
      
      // Colecciones
      if (collectionsRes.status === 'fulfilled') {
        setCollections(collectionsRes.value.data.collections || [])
      }
      
      // Si el artículo ya existe, obtener sus collection_ids
      if (articleRes.status === 'fulfilled' && articleRes.value.data) {
        const existingCollections = articleRes.value.data.collection_ids || []
        setAlreadySavedIn(existingCollections)
      } else {
        setAlreadySavedIn([])
      }
    } catch (err) {
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCollection = (collectionId) => {
    // No permitir seleccionar colecciones donde ya está guardado
    if (alreadySavedIn.includes(collectionId)) return
    
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(id => id !== collectionId)
      } else {
        return [...prev, collectionId]
      }
    })
  }

  const handleSave = async () => {
    if (selectedCollections.length === 0) {
      setError('Selecciona al menos una colección')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Si el artículo ya existe en alguna colección, solo añadir a las nuevas
      if (alreadySavedIn.length > 0) {
        // El artículo ya existe, solo añadir a las colecciones seleccionadas
        const promises = selectedCollections.map(collectionId =>
          collectionsAPI.addArticle(collectionId, articleId)
        )
        await Promise.all(promises)
      } else {
        // El artículo no existe, crear en la primera y añadir a las demás
        const firstCollection = selectedCollections[0]
        const response = await openalexAPI.saveWork(articleId, firstCollection)
        const savedArticleId = response.data

        if (selectedCollections.length > 1 && savedArticleId) {
          const remainingCollections = selectedCollections.slice(1)
          const promises = remainingCollections.map(collectionId =>
            collectionsAPI.addArticle(collectionId, savedArticleId)
          )
          await Promise.all(promises)
        }
      }

      onSuccess && onSuccess(`Artículo guardado en ${selectedCollections.length} colección(es)`)
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar el artículo')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="save-modal-overlay" onClick={onClose}>
      <div className="save-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="save-modal-header">
          <h2>
            <i className="fas fa-bookmark"></i>
            Guardar en colección
          </h2>
          <button className="save-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="save-modal-body">
          {error && (
            <div className="save-modal-error">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {loading ? (
            <div className="save-modal-loading">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Cargando colecciones...</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="save-modal-empty">
              <i className="fas fa-folder-open"></i>
              <p>No tienes colecciones</p>
              <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                Crea una colección primero
              </p>
            </div>
          ) : (
            <div className="save-modal-collections">
              {collections.map(collection => {
                const isSelected = selectedCollections.includes(collection._id)
                const isAlreadySaved = alreadySavedIn.includes(collection._id)
                return (
                  <div
                    key={collection._id}
                    className={`save-modal-item ${isSelected ? 'selected' : ''} ${isAlreadySaved ? 'already-saved' : ''}`}
                    onClick={() => handleToggleCollection(collection._id)}
                  >
                    <div className="save-modal-checkbox">
                      <i className="fas fa-check"></i>
                    </div>
                    <div 
                      className="save-modal-color"
                      style={{ backgroundColor: collection.color || '#3B82F6' }}
                    >
                      <i className="fas fa-folder"></i>
                    </div>
                    <div className="save-modal-info">
                      <h3 className="save-modal-name">{collection.name}</h3>
                      <span className="save-modal-count">
                        {isAlreadySaved ? (
                          <><i className="fas fa-check" style={{ marginRight: '0.3rem' }}></i>Ya guardado</>
                        ) : (
                          `${collection.article_count || 0} artículos`
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="save-modal-footer">
          <button 
            className="save-modal-btn save-modal-btn-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button 
            className="save-modal-btn save-modal-btn-save"
            onClick={handleSave}
            disabled={saving || selectedCollections.length === 0 || loading}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Guardando...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                Guardar
                {selectedCollections.length > 0 && (
                  <span className="save-modal-badge">
                    {selectedCollections.length}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SaveToCollectionsModal
