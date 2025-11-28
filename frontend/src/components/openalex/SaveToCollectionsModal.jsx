import { useState, useEffect } from 'react'
import { collectionsAPI, openalexAPI } from '../../api/api'
import '../../styles/openalex/SaveToCollectionsModal.css'

function SaveToCollectionsModal({ isOpen, onClose, articleIds = [], onSuccess }) {
  const [collections, setCollections] = useState([])
  const [selectedCollections, setSelectedCollections] = useState([])
  const [preselectedCollections, setPreselectedCollections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && articleIds.length > 0) {
      loadData()
      setError(null)
    }
  }, [isOpen, articleIds.length])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const collectionsRes = await collectionsAPI.getAll()

      if (collectionsRes.status === 200 || collectionsRes.data) {
        const allCollections = collectionsRes.data.collections || []
        setCollections(allCollections)
        
        // Preseleccionar colecciones que ya contienen alguno de los artículos
        await preselectCollections(allCollections)
      }
    } catch (err) {
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const preselectCollections = async (allCollections) => {
    try {
      const preselected = []
      
      // Para cada colección, verificar si contiene TODOS los artículos
      for (const collection of allCollections) {
        try {
          const idsRes = await collectionsAPI.getIdsbyCollection(collection._id)
          
          if (idsRes.status === 200 || idsRes.data) {
            const collectionArticleIds = idsRes.data.article_ids || []
            
            // Solo preseleccionar si TODOS los artículos están en esta colección
            const allArticlesInCollection = articleIds.every(id => 
              collectionArticleIds.includes(id) || 
              collectionArticleIds.some(colId => colId.includes(id) || id.includes(colId))
            )
            
            if (allArticlesInCollection) {
              preselected.push(collection._id)
            }
          }
        } catch (err) {
          // Continuar con la siguiente colección si hay error
          console.warn(`Error checking collection ${collection._id}:`, err)
        }
      }
      
      setSelectedCollections(preselected)
      setPreselectedCollections(preselected)
    } catch (err) {
      console.warn('Error preselecting collections:', err)
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
    try {
      setSaving(true)
      setError(null)

      // Separar las colecciones en 3 grupos:
      // 1. Nuevas: están en selectedCollections pero NO en preselectedCollections (añadir)
      // 2. Eliminadas: están en preselectedCollections pero NO en selectedCollections (quitar)
      // 3. Mantenidas: están en ambas (no hacer nada)
      
      const newCollections = selectedCollections.filter(id => !preselectedCollections.includes(id))
      const removedCollections = preselectedCollections.filter(id => !selectedCollections.includes(id))

      const ops = []

      // Añadir artículos a las colecciones nuevas
      for (const collectionId of newCollections) {
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

      // Eliminar artículos de las colecciones deseleccionadas
      for (const collectionId of removedCollections) {
        for (const articleId of articleIds) {
          ops.push((async () => {
            try {
              return await collectionsAPI.removeArticle(collectionId, articleId)
            } catch (err) {
              console.warn(`Error removing article ${articleId} from collection ${collectionId}:`, err)
              // No lanzar error aquí, continuar con las demás operaciones
            }
          })())
        }
      }

      await Promise.all(ops)

      // Construir mensaje basado en las operaciones realizadas
      let message = ''
      if (articleIds.length === 1) {
        if (newCollections.length > 0 && removedCollections.length > 0) {
          message = `Artículo guardado en ${newCollections.length} y eliminado de ${removedCollections.length} colección(es)`
        } else if (newCollections.length > 0) {
          message = `Artículo guardado en ${newCollections.length} colección(es)`
        } else if (removedCollections.length > 0) {
          message = `Artículo eliminado de ${removedCollections.length} colección(es)`
        } else {
          message = 'Sin cambios realizados'
        }
      } else {
        if (newCollections.length > 0 && removedCollections.length > 0) {
          message = `${articleIds.length} artículos guardados en ${newCollections.length} y eliminados de ${removedCollections.length} colección(es)`
        } else if (newCollections.length > 0) {
          message = `${articleIds.length} artículos guardados en ${newCollections.length} colección(es)`
        } else if (removedCollections.length > 0) {
          message = `${articleIds.length} artículos eliminados de ${removedCollections.length} colección(es)`
        } else {
          message = 'Sin cambios realizados'
        }
      }

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
                const isPreselected = preselectedCollections.includes(collection._id)
                return (
                  <div
                    key={collection._id}
                    className={`save-modal-item ${isSelected ? 'selected' : ''} ${isPreselected ? 'preselected' : ''}`}
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
                {(() => {
                  const newSelections = selectedCollections.filter(
                    id => !preselectedCollections.includes(id)
                  ).length
                  return newSelections > 0 && (
                    <span className="save-modal-badge">
                      {newSelections}
                    </span>
                  )
                })()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SaveToCollectionsModal
