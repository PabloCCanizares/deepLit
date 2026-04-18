import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { collectionsAPI, openalexAPI } from '../../api/index.js'
import { getErrorMessage } from '../../utils/errorUtils'
import { invalidateOpenAlexMembershipQueries } from '../../utils/openalexMembershipQueries'
import '../../styles/openalex/SaveToCollectionsModal.css'

function buildSaveMessage(articleCount, newCollectionsCount, removedCollectionsCount) {
  if (articleCount === 1) {
    if (newCollectionsCount > 0 && removedCollectionsCount > 0) {
      return `Artículo guardado en ${newCollectionsCount} y eliminado de ${removedCollectionsCount} colección(es)`
    }
    if (newCollectionsCount > 0) {
      return `Artículo guardado en ${newCollectionsCount} colección(es)`
    }
    if (removedCollectionsCount > 0) {
      return `Artículo eliminado de ${removedCollectionsCount} colección(es)`
    }
    return 'Sin cambios realizados'
  }

  if (newCollectionsCount > 0 && removedCollectionsCount > 0) {
    return `${articleCount} artículos guardados en ${newCollectionsCount} y eliminados de ${removedCollectionsCount} colección(es)`
  }
  if (newCollectionsCount > 0) {
    return `${articleCount} artículos guardados en ${newCollectionsCount} colección(es)`
  }
  if (removedCollectionsCount > 0) {
    return `${articleCount} artículos eliminados de ${removedCollectionsCount} colección(es)`
  }
  return 'Sin cambios realizados'
}

function SaveToCollectionsModal({ isOpen, onClose, articleIds = [], onSuccess }) {
  const queryClient = useQueryClient()
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
        await preselectCollections(allCollections)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar datos'))
    } finally {
      setLoading(false)
    }
  }

  const preselectCollections = async (allCollections) => {
    try {
      const preselected = []

      for (const collection of allCollections) {
        try {
          const idsRes = await collectionsAPI.getIdsbyCollection(collection._id)

          if (idsRes.status === 200 || idsRes.data) {
            const collectionArticleIds = idsRes.data.article_ids || []
            const allArticlesInCollection = articleIds.every((id) =>
              collectionArticleIds.includes(id)
            )

            if (allArticlesInCollection) {
              preselected.push(collection._id)
            }
          }
        } catch {}
      }

      setSelectedCollections(preselected)
      setPreselectedCollections(preselected)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo preparar la selección inicial'))
    }
  }

  const handleToggleCollection = (collectionId) => {
    setSelectedCollections((prev) => {
      if (prev.includes(collectionId)) {
        return prev.filter((id) => id !== collectionId)
      }
      return [...prev, collectionId]
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const newCollections = selectedCollections.filter((id) => !preselectedCollections.includes(id))
      const removedCollections = preselectedCollections.filter((id) => !selectedCollections.includes(id))

      for (const collectionId of newCollections) {
        for (const articleId of articleIds) {
          try {
            await collectionsAPI.addArticle(collectionId, articleId)
          } catch (err) {
            const msg = err && err.message ? err.message.toString().toLowerCase() : ''
            if (msg.includes('no encontrado') || msg.includes('not found') || err.status === 404) {
              await openalexAPI.saveWork(articleId, collectionId)
            } else {
              throw err
            }
          }
        }
      }

      for (const collectionId of removedCollections) {
        for (const articleId of articleIds) {
          await collectionsAPI.removeArticle(collectionId, articleId)
        }
      }

      await invalidateOpenAlexMembershipQueries(queryClient)

      const message = buildSaveMessage(articleIds.length, newCollections.length, removedCollections.length)
      onSuccess?.(message)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Error al guardar los artículos'))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const newSelectionsCount = selectedCollections.filter(
    (id) => !preselectedCollections.includes(id)
  ).length
  const hasChanges =
    newSelectionsCount > 0 ||
    preselectedCollections.some((id) => !selectedCollections.includes(id))

  return (
    <div className="save-modal-overlay" onClick={onClose}>
      <div className="save-modal" onClick={(event) => event.stopPropagation()}>
        <div className="save-modal-header">
          <h2>
            <i className="fas fa-bookmark"></i>
            {articleIds.length === 1 ? 'Guardar en colección' : `Guardar ${articleIds.length} artículos en colecciones`}
          </h2>
          <button className="save-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

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
              {collections.map((collection) => {
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
            disabled={saving || loading || !hasChanges}
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
                {newSelectionsCount > 0 && (
                  <span className="save-modal-badge">
                    {newSelectionsCount}
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
