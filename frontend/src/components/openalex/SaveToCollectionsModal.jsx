import { useState, useEffect } from 'react'
import { collectionsAPI, openalexAPI } from '../../api/api'
import '../../styles/openalex/SaveToCollectionsModal.css'

function SaveToCollectionsModal({ isOpen, onClose, articleIds = [], onSuccess }) {
  const [collections, setCollections] = useState([])
  const [selectedCollections, setSelectedCollections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && articleIds.length > 0) {
      loadData()
      setSelectedCollections([])
      setError(null)
    }
  }, [isOpen, articleIds.length])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const collectionsRes = await collectionsAPI.getAll()

      if (collectionsRes.status === 200 || collectionsRes.data) {
        setCollections(collectionsRes.data.collections || [])
      }
    } catch (err) {
      setError(err.message || 'Error al cargar datos')
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

  const handleSave = async () => {
    if (selectedCollections.length === 0) {
      setError('Selecciona al menos una colección')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Añadir todos los artículos a todas las colecciones seleccionadas.
      // Si la API responde que el artículo no existe en la BD, intentar
      // guardar el work de OpenAlex directamente en esa colección usando
      // openalexAPI.saveWork(articleId, collectionId).
      const ops = []
      for (const collectionId of selectedCollections) {
        for (const articleId of articleIds) {
          ops.push((async () => {
            try {
              return await collectionsAPI.addArticle(collectionId, articleId)
            } catch (err) {
              const msg = err && err.message ? err.message.toString().toLowerCase() : ''
              // Si el error indica que no existe, intentar guardar desde OpenAlex
              if (msg.includes('no encontrado') || msg.includes('not found') || err.status === 404) {
                // Guardar el work en la colección (backend manejará creación + asociación)
                return await openalexAPI.saveWork(articleId, collectionId)
              }
              throw err
            }
          })())
        }
      }

      await Promise.all(ops)

      const message = articleIds.length === 1
        ? `Artículo guardado en ${selectedCollections.length} colección(es)`
        : `${articleIds.length} artículos guardados en ${selectedCollections.length} colección(es)`

      onSuccess && onSuccess(message)
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar los artículos')
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
            {articleIds.length === 1 ? 'Guardar en colección' : `Guardar ${articleIds.length} artículos en colecciones`}
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
                return (
                  <div
                    key={collection._id}
                    className={`save-modal-item ${isSelected ? 'selected' : ''}`}
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
                        {collection.article_count || 0} artículos
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
