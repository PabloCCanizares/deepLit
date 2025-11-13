import { useState, useEffect, useRef } from 'react'
import '../../styles/collections/CreateCollectionModal.css'

function CreateCollectionModal({ isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    image: null,
    selectedArticles: []
  })
  const [imagePreview, setImagePreview] = useState(null)
  const [showArticleSelector, setShowArticleSelector] = useState(false)
  const fileInputRef = useRef(null)

  // Mock de artículos disponibles (esto se conectará al backend después)
  const availableArticles = [
    { id: 1, title: 'Artículo 1' },
    { id: 2, title: 'Artículo 2' },
    { id: 3, title: 'Artículo 3' },
    { id: 4, title: 'Artículo 4' },
    { id: 5, title: 'Artículo 5' }
  ]

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

  const handleClose = () => {
    // Reset form
    setFormData({
      name: '',
      category: '',
      image: null,
      selectedArticles: []
    })
    setImagePreview(null)
    setShowArticleSelector(false)
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

      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
        setFormData(prev => ({ ...prev, image: e.target.result }))
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

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Por favor ingresa un nombre para la colección')
      return
    }
    
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

          {/* Categoría con placeholder */}
          <div className="form-group">
            <input
              name="category"
              type="text"
              value={formData.category}
              onChange={handleInputChange}
              placeholder="Categoría"
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
              <div className="article-selector">
                <div className="article-selector-header">
                  <span>Mis Documentos</span>
                  <span className="selected-count">
                    {formData.selectedArticles.length} seleccionados
                  </span>
                </div>
                <div className="article-list">
                  {availableArticles.map(article => (
                    <div
                      key={article.id}
                      className={`article-item ${formData.selectedArticles.includes(article.id) ? 'selected' : ''}`}
                      onClick={() => handleArticleToggle(article.id)}
                    >
                      <div className="article-checkbox">
                        <i className={`fas ${formData.selectedArticles.includes(article.id) ? 'fa-check-square' : 'fa-square'}`}></i>
                      </div>
                      <span className="article-title">{article.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={handleClose}>
            Cancelar
          </button>
          <button className="btn-save" onClick={handleSave}>
            Guardar Colección
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateCollectionModal
