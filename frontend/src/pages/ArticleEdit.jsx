import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesAPI } from '../api/api'
import '../styles/articles/ArticleViewEdit.css'

const ArticleEdit = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    year: '',
    category: '',
    type: '',
    citations: '',
    pages: '',
    observations: '',
    link: '',
    summary: '',
    abstract: '',
    authors: '',
  })

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await articlesAPI.getById(id)
        const document = response.data
        
        setFormData({
          title: document.title || '',
          year: document.year || '',
          category: document.category || '',
          type: document.type || '',
          citations: document.citations || '',
          pages: document.pages || '',
          observations: document.observations || '',
          link: document.link || '',
          summary: document.summary || '',
          abstract: document.abstract || '',
          authors: document.authors || '',
        })
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el artículo: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchDocument()
    }
  }, [id])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await articlesAPI.update(id, formData)
      navigate(`/articles/${id}`)
    } catch (err) {
      console.error('Error saving document:', err)
      setError('Error al guardar el artículo')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate(`/articles/${id}`)
  }

  const handleDelete = async () => {
    try {
      await articlesAPI.delete(id)
      navigate('/articles')
    } catch (err) {
      console.error('Error deleting article:', err)
      setError('Error al eliminar el artículo')
      setShowDeleteModal(false)
    }
  }

  if (loading) {
    return (
      <div className="documentEditContainer">
        <div className="loading">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--main_color)' }}></i>
          <p>Cargando artículo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="documentEditContainer">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="documentEditContainer">
      <div className="documentHeader">
        <h1 style={{ color: 'var(--main_color)' }}>Editar Artículo</h1>
        <div className="documentActions">
          <button 
            onClick={handleCancel} 
            className="btn-secondary"
            disabled={saving}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <form className="documentForm" onSubmit={(e) => e.preventDefault()}>
        <div className="formSection formSectionFirst">
          <h3>Información Básica</h3>
          
          <div className="formField">
            <label htmlFor="title">Título *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="authors">Autor(es)</label>
            <input
              type="text"
              id="authors"
              name="authors"
              value={formData.authors}
              onChange={handleInputChange}
              placeholder="Separar múltiples autores con comas"
            />
          </div>

          <div className="formRow">
            <div className="formField">
              <label htmlFor="year">Año</label>
              <input
                type="number"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleInputChange}
                min="1900"
                max="2030"
              />
            </div>

            <div className="formField">
              <label htmlFor="category">Categoría</label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Ej: Technology, Healthcare"
              />
            </div>
          </div>
        </div>

        <div className="formSection">
          <h3>Detalles de Publicación</h3>
          
          <div className="formField">
            <label htmlFor="type">Tipo</label>
            <input
              type="text"
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              placeholder="Ej: Research Article, Conference Paper"
            />
          </div>

          <div className="formRow">

            <div className="formField">
              <label htmlFor="citations">Citas</label>
              <input
                type="number"
                id="citations"
                name="citations"
                value={formData.citations}
                onChange={handleInputChange}
                min="0"
              />
            </div>

            <div className="formField">
              <label htmlFor="pages">Páginas</label>
              <input
                type="text"
                id="pages"
                name="pages"
                value={formData.pages}
                onChange={handleInputChange}
                placeholder="Ej: 123-145"
              />
            </div>
          </div>

          <div className="formField">
            <label htmlFor="observations">Observaciones</label>
            <textarea
              id="observations"
              name="observations"
              value={formData.observations}
              onChange={handleInputChange}
              rows="3"
              placeholder="Observaciones adicionales..."
            />
          </div>

          <div className="formField">
            <label htmlFor="link">Enlace</label>
            <input
              type="url"
              id="link"
              name="link"
              value={formData.link}
              onChange={handleInputChange}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="formSection">
          <h3>Contenido</h3>

          <div className="formField">
            <label htmlFor="summary">Resumen (Español)</label>
            <textarea
              id="summary"
              name="summary"
              value={formData.summary}
              onChange={handleInputChange}
              rows="6"
              placeholder="Resumen en español..."
            />
          </div>

          <div className="formField">
            <label htmlFor="abstract">Abstract (Inglés)</label>
            <textarea
              id="abstract"
              name="abstract"
              value={formData.abstract}
              onChange={handleInputChange}
              rows="6"
              placeholder="Abstract en inglés..."
            />
          </div>

        </div>
      </form>

      {/* Botón de eliminar */}
      <div style={{ 
        marginTop: '1rem', 
        display: 'flex', 
        justifyContent: 'center',
        maxWidth: '1200px',
        margin: '1rem auto 0',
        padding: '0 2rem'
      }}>
        <button 
          onClick={() => setShowDeleteModal(true)} 
          className="btn-primary btn-delete-article"
          disabled={saving}
          style={{ 
            minWidth: '250px',
            padding: '12px 24px',
            fontSize: '1rem'
          }}
        >
          <i className="fas fa-trash" style={{ marginRight: '0.5rem' }}></i>
          Eliminar Artículo
        </button>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-exclamation-triangle" style={{ color: 'var(--color-danger)' }}></i>
                {' '}Confirmar Eliminación
              </h2>
            </div>
            <div className="modal-body">
              <p>¿Estás seguro de que quieres eliminar este artículo?</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete} 
                className="btn-primary"
              >
                <i className="fas fa-trash" style={{ marginRight: '0.5rem' }}></i>
                Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArticleEdit