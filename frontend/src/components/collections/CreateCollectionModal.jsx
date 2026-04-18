import { useState, useEffect, useRef } from 'react'

import { articlesAPI, collectionsAPI } from '../../api/index.js'
import { getErrorMessage } from '../../utils/errorUtils'
import SearchBarDebounced from '../articles/SearchBarDebounced'
import '../../styles/collections/CreateCollectionModal.css'

function CreateCollectionModal({
  isOpen,
  onClose,
  onSave,
  collection,
  allowArticleSelection = true,
  initialData = null,
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: null,
    selectedArticles: [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [showArticleSelector, setShowArticleSelector] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const [articles, setArticles] = useState([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
  })

  useEffect(() => {
    if (isOpen && collection) {
      setError('')
      setFormData({
        name: collection.name || '',
        description: collection.description || '',
        image: null,
        selectedArticles: [],
      })

      if (collection.image_url) {
        collectionsAPI.getImage(collection._id)
          .then((blobUrl) => {
            if (blobUrl) {
              setImagePreview(blobUrl)
            }
          })
          .catch((err) => {
            setError(getErrorMessage(err, 'No se pudo cargar la imagen de la colección'))
            setImagePreview(null)
          })
      } else {
        setImagePreview(null)
      }

      if (allowArticleSelection) {
        loadCollectionArticles()
      }
    } else if (isOpen) {
      setError('')
      setFormData({
        name: initialData?.name || '',
        description: initialData?.description || '',
        image: null,
        selectedArticles: [],
      })
      setImagePreview(null)
    }

    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [isOpen, collection, initialData, allowArticleSelection])

  const loadCollectionArticles = async () => {
    if (!collection) return

    try {
      const response = await collectionsAPI.getWithArticles(collection._id)
      const collectionArticles = response.data.articles || []
      const articleIds = collectionArticles.map((article) => article._id || article.id)
      setFormData((prev) => ({ ...prev, selectedArticles: articleIds }))
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar los artículos de la colección'))
    }
  }

  useEffect(() => {
    if (isOpen && showArticleSelector && allowArticleSelection) {
      loadArticles()
    }
  }, [isOpen, showArticleSelector, pagination.offset, pagination.limit, searchQuery, allowArticleSelection])

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  const loadArticles = async () => {
    try {
      setLoadingArticles(true)
      setError('')
      const response = await articlesAPI.getArticles({
        limit: pagination.limit,
        offset: pagination.offset,
        filters: { title: searchQuery },
      })
      setArticles(response.data.articles)
      setPagination((prev) => ({
        ...prev,
        total: response.data.total,
      }))
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar los artículos disponibles'))
    } finally {
      setLoadingArticles(false)
    }
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    setPagination((prev) => ({ ...prev, offset: 0 }))
  }

  const handleClose = (force = false) => {
    if (isSaving && !force) return

    setFormData({
      name: '',
      description: '',
      image: null,
      selectedArticles: [],
    })
    setImagePreview(null)
    setShowArticleSelector(false)
    setSearchQuery('')
    setArticles([])
    setError('')
    onClose()
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageSelect = (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const base64 = loadEvent.target.result
      setFormData((prev) => ({ ...prev, image: base64 }))
      setImagePreview(base64)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setError('')
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleArticleToggle = (articleId) => {
    setFormData((prev) => {
      const isSelected = prev.selectedArticles.includes(articleId)
      return {
        ...prev,
        selectedArticles: isSelected
          ? prev.selectedArticles.filter((id) => id !== articleId)
          : [...prev.selectedArticles, articleId],
      }
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Por favor ingresa un nombre para la colección')
      return
    }

    try {
      setError('')
      setIsSaving(true)
      await onSave(formData)
      handleClose(true)
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo guardar la colección'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content create-collection-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-body">
          {error && (
            <div className="create-collection-error">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          <div className="image-selector-section">
            <div className="image-selector" onClick={handleImageClick}>
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="image-preview" />
              ) : (
                <div className="image-placeholder">
                  <i className="fas fa-camera"></i>
                  <span>Seleccionar imagen</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
          </div>

          <div className="form-group">
            <input
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Nombre"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <input
              name="description"
              type="text"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Descripción"
              className="form-input"
            />
          </div>

          {allowArticleSelection && (
            <div className="form-group">
              {!showArticleSelector && (
                <button
                  type="button"
                  className="add-articles-btn"
                  onClick={() => setShowArticleSelector(true)}
                  disabled={isSaving}
                >
                  <i className="fas fa-plus"></i>
                  Añadir artículos ({formData.selectedArticles.length})
                </button>
              )}

              {showArticleSelector && (
                <div className="article-selector-expanded">
                  <div className="article-selector-header">
                    <div className="header-left">
                      <h3>Seleccionar Artículos</h3>
                      <span className="selected-count">
                        {formData.selectedArticles.length} seleccionados
                      </span>
                    </div>
                    <button
                      className="collapse-btn"
                      onClick={() => setShowArticleSelector(false)}
                      title="Colapsar"
                      disabled={isSaving}
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>
                  </div>

                  <div className="article-search">
                    <SearchBarDebounced
                      onSearch={handleSearch}
                      placeholder="Buscar por título"
                    />
                  </div>

                  <div className="pagination-info">
                    <span>Mostrando {articles.length} de {pagination.total} artículos</span>
                  </div>

                  <div className="article-list-container-simple">
                    {loadingArticles ? (
                      <div className="loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Cargando artículos...</p>
                      </div>
                    ) : articles.length === 0 ? (
                      <div className="empty-state">
                        <i className="fas fa-inbox"></i>
                        <p>No se encontraron artículos</p>
                      </div>
                    ) : (
                      <div className="simple-article-list">
                        {articles.map((article) => {
                          const articleId = article._id || article.id
                          const isSelected = formData.selectedArticles.includes(articleId)

                          return (
                            <div
                              key={articleId}
                              className={`simple-article-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleArticleToggle(articleId)}
                            >
                              <div className="article-checkbox">
                                <i className={`fas ${isSelected ? 'fa-check-square' : 'fa-square'}`}></i>
                              </div>
                              <div className="article-content">
                                <div className="article-row">
                                  <span className="article-label">Título:</span>
                                  <span className="article-value">{article.title || '-'}</span>
                                </div>
                                <div className="article-row">
                                  <span className="article-label">Categoría:</span>
                                  <span className="article-value">{article.category || '-'}</span>
                                </div>
                                <div className="article-row-inline">
                                  <div className="article-inline-item">
                                    <span className="article-label">Páginas:</span>
                                    <span className="article-value">{article.pages || '-'}</span>
                                  </div>
                                  <div className="article-inline-item">
                                    <span className="article-label">Año:</span>
                                    <span className="article-value">{article.year || '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {pagination.total > pagination.limit && (
                    <div className="pagination-controls-mini">
                      <button
                        onClick={() => setPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                        disabled={pagination.offset === 0}
                        className="pagination-btn"
                      >
                        <i className="fas fa-chevron-left"></i>
                        <span>Anterior</span>
                      </button>
                      <div className="pagination-info-center">
                        <span className="page-current">{Math.floor(pagination.offset / pagination.limit) + 1}</span>
                        <span className="page-separator">/</span>
                        <span className="page-total">{Math.ceil(pagination.total / pagination.limit)}</span>
                      </div>
                      <button
                        onClick={() => setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }))}
                        disabled={pagination.offset + pagination.limit >= pagination.total}
                        className="pagination-btn"
                      >
                        <span>Siguiente</span>
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={handleClose} disabled={isSaving}>
            Cancelar
          </button>
          <button className="btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : collection ? 'Guardar Cambios' : 'Guardar Colección'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateCollectionModal
