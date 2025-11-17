import { useState, useEffect, useRef } from 'react'
import { articlesAPI, collectionsAPI } from '../../api/api'
import SearchBarDebounced from '../articles/SearchBarDebounced'
import '../../styles/collections/CreateCollectionModal.css'

function CreateCollectionModal({ isOpen, onClose, onSave, collection }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: null,
    selectedArticles: []
  })
  const [imagePreview, setImagePreview] = useState(null)
  const [showArticleSelector, setShowArticleSelector] = useState(false)
  const fileInputRef = useRef(null)

  // Estados para artículos reales
  const [articles, setArticles] = useState([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0
  })

  // Cargar datos de la colección cuando se abre en modo edición
  useEffect(() => {
    if (isOpen && collection) {
      setFormData({
        name: collection.name || '',
        description: collection.description || '',
        image: null,
        selectedArticles: []
      })
      
      // Si la colección tiene imagen, cargarla usando la API
      if (collection.image_url) {
        collectionsAPI.getImage(collection._id)
          .then(blobUrl => {
            if (blobUrl) {
              setImagePreview(blobUrl)
            }
          })
          .catch(err => {
            console.error('Error loading collection image:', err)
            setImagePreview(null)
          })
      } else {
        setImagePreview(null)
      }

      // Cargar artículos de la colección
      loadCollectionArticles()
    } else if (isOpen) {
      // Resetear formulario en modo creación
      setFormData({
        name: '',
        description: '',
        image: null,
        selectedArticles: []
      })
      setImagePreview(null)
    }
    
    // Cleanup blob URL on unmount
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [isOpen, collection])

  const loadCollectionArticles = async () => {
    if (!collection) return
    
    try {
      const response = await collectionsAPI.getWithArticles(collection._id)
      const collectionArticles = response.data.articles || []
      const articleIds = collectionArticles.map(a => a._id || a.id)
      setFormData(prev => ({ ...prev, selectedArticles: articleIds }))
    } catch (err) {
      console.error('Error loading collection articles:', err)
    }
  }

  // Cargar artículos cuando se abre el selector
  useEffect(() => {
    if (isOpen && showArticleSelector) {
      loadArticles()
    }
  }, [isOpen, showArticleSelector, pagination.offset, pagination.limit, searchQuery])

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  const loadArticles = async () => {
    try {
      setLoadingArticles(true)
      const response = await articlesAPI.getArticles({ 
        limit: pagination.limit, 
        offset: pagination.offset,
        filters: {"title": searchQuery} 
      })
      setArticles(response.data.articles)
      setPagination(prev => ({
        ...prev,
        total: response.data.total
      }))
    } catch (err) {
      console.error('Error loading articles:', err)
    } finally {
      setLoadingArticles(false)
    }
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleClose = () => {
    // Reset form
    setFormData({
      name: '',
      description: '',
      image: null,
      selectedArticles: []
    })
    setImagePreview(null)
    setShowArticleSelector(false)
    setSearchQuery('')
    setArticles([])
    onClose()
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona una imagen válida')
        return
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen no debe superar 5MB')
        return
      }

      // Convertir a base64
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target.result
        setFormData(prev => ({ ...prev, image: base64 }))
        setImagePreview(base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleArticleToggle = (articleId) => {
    setFormData(prev => {
      const isSelected = prev.selectedArticles.includes(articleId)
      return {
        ...prev,
        selectedArticles: isSelected
          ? prev.selectedArticles.filter(id => id !== articleId)
          : [...prev.selectedArticles, articleId]
      }
    })
  }

  const handleSelectAll = () => {
    if (formData.selectedArticles.length === articles.length) {
      setFormData(prev => ({ ...prev, selectedArticles: [] }))
    } else {
      setFormData(prev => ({ 
        ...prev, 
        selectedArticles: articles.map(article => article._id || article.id)
      }))
    }
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Por favor ingresa un nombre para la colección')
      return
    }
    
    console.log('\n=== SAVE COLLECTION ===')
    console.log('Form data:', formData)
    console.log('Image type:', typeof formData.image)
    console.log('Image:', formData.image ? formData.image.substring(0, 100) + '...' : 'None')
    
    onSave(formData)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content create-collection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          {/* Selector de imagen sin título */}
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

          {/* Nombre con placeholder */}
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

          {/* Descripción con placeholder */}
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

          {/* Selector de artículos */}
          <div className="form-group">
            {!showArticleSelector && (
              <button
                type="button"
                className="add-articles-btn"
                onClick={() => setShowArticleSelector(true)}
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
                  >
                    <i className="fas fa-chevron-up"></i>
                  </button>
                </div>

                {/* Buscador */}
                <div className="article-search">
                  <SearchBarDebounced 
                    onSearch={handleSearch}
                    placeholder="Buscar por título"
                  />
                </div>

                {/* Información de paginación */}
                <div className="pagination-info">
                  <span>Mostrando {articles.length} de {pagination.total} artículos</span>
                </div>

                {/* Lista de artículos */}
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
                      {articles.map(article => {
                        const isSelected = formData.selectedArticles.includes(article._id || article.id)
                        return (
                          <div
                            key={article._id || article.id}
                            className={`simple-article-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleArticleToggle(article._id || article.id)}
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

                {/* Paginación mejorada */}
                {pagination.total > pagination.limit && (
                  <div className="pagination-controls-mini">
                    <button 
                      onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
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
                      onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
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
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={handleClose}>
            Cancelar
          </button>
          <button className="btn-save" onClick={handleSave}>
            {collection ? 'Guardar Cambios' : 'Guardar Colección'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateCollectionModal
