import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesAPI } from '../api/api'
import '../styles/documents/DocumentViewEdit.css'

const DocumentEdit = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    year: '',
    category: '',
    type: '',
    citations: '',
    pages: '',
    observations: '',
    link: '',
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
          abstract: document.abstract || '',
          authors: document.authors || '',
        })
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el documento: ${err.message}`)
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
      navigate(`/documents/${id}`)
    } catch (err) {
      console.error('Error saving document:', err)
      setError('Error al guardar el documento')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate(`/documents/${id}`)
  }

  if (loading) {
    return (
      <div className="documentEditContainer">
        <div className="loading">
          <i className="fas fa-spinner"></i>
          <p>Cargando documento...</p>
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
        <h1 style={{ color: 'var(--main_color)' }}>Editar Documento</h1>
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
            <label htmlFor="abstract">Resumen</label>
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
    </div>
  )
}

export default DocumentEdit