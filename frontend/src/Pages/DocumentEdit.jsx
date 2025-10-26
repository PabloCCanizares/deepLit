import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesAPI } from '../Api/articlesAPI.js'
import '../styles/Documents/DocumentViewEdit.css'

const DocumentEdit = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    Title: '',
    Year: '',
    Category: '',
    Type: '',
    Acronym: '',
    Cites: '',
    Pag: '',
    Obs: '',
    Summary: '',
    link: '',
    citation: '',
    abstract: '',
    autores: '',
    filename: ''
  })

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('Fetching document for edit with ID:', id)
        console.log('articlesAPI:', articlesAPI)
        
        const response = await articlesAPI.getById(id)
        console.log('Edit Response:', response)
        const document = response.data
        
        setFormData({
          Title: document.Title || document.title || '',
          Year: document.Year || document.year || '',
          Category: document.Category || document.category || '',
          Type: document.Type || '',
          Acronym: document.Acronym || '',
          Cites: document.Cites || '',
          Pag: document.Pag || document.pages || '',
          Obs: document.Obs || '',
          Summary: document.Summary || '',
          link: document.link || '',
          citation: document.citation || '',
          abstract: document.abstract || '',
          autores: document.autores || document.authors || '',
          filename: document.filename || ''
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
            <label htmlFor="Title">Título *</label>
            <input
              type="text"
              id="Title"
              name="Title"
              value={formData.Title}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="autores">Autor(es)</label>
            <input
              type="text"
              id="autores"
              name="autores"
              value={formData.autores}
              onChange={handleInputChange}
              placeholder="Separar múltiples autores con comas"
            />
          </div>

          <div className="formRow">
            <div className="formField">
              <label htmlFor="Year">Año</label>
              <input
                type="number"
                id="Year"
                name="Year"
                value={formData.Year}
                onChange={handleInputChange}
                min="1900"
                max="2030"
              />
            </div>

            <div className="formField">
              <label htmlFor="Category">Categoría</label>
              <input
                type="text"
                id="Category"
                name="Category"
                value={formData.Category}
                onChange={handleInputChange}
                placeholder="Ej: Technology, Healthcare"
              />
            </div>
          </div>
        </div>

        <div className="formSection">
          <h3>Detalles de Publicación</h3>
          
          <div className="formField">
            <label htmlFor="Type">Tipo</label>
            <input
              type="text"
              id="Type"
              name="Type"
              value={formData.Type}
              onChange={handleInputChange}
              placeholder="Ej: Research Article, Conference Paper"
            />
          </div>

          <div className="formRow">
            <div className="formField">
              <label htmlFor="Acronym">Acrónimo</label>
              <input
                type="text"
                id="Acronym"
                name="Acronym"
                value={formData.Acronym}
                onChange={handleInputChange}
              />
            </div>

            <div className="formField">
              <label htmlFor="Cites">Citas</label>
              <input
                type="number"
                id="Cites"
                name="Cites"
                value={formData.Cites}
                onChange={handleInputChange}
                min="0"
              />
            </div>

            <div className="formField">
              <label htmlFor="Pag">Páginas</label>
              <input
                type="text"
                id="Pag"
                name="Pag"
                value={formData.Pag}
                onChange={handleInputChange}
                placeholder="Ej: 123-145"
              />
            </div>
          </div>

          <div className="formField">
            <label htmlFor="Obs">Observaciones</label>
            <textarea
              id="Obs"
              name="Obs"
              value={formData.Obs}
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

          <div className="formField">
            <label htmlFor="filename">Nombre del archivo</label>
            <input
              type="text"
              id="filename"
              name="filename"
              value={formData.filename}
              onChange={handleInputChange}
              placeholder="nombre_archivo.pdf"
            />
          </div>
        </div>

        <div className="formSection">
          <h3>Contenido</h3>
          
          <div className="formField">
            <label htmlFor="Summary">Resumen</label>
            <textarea
              id="Summary"
              name="Summary"
              value={formData.Summary}
              onChange={handleInputChange}
              rows="4"
              placeholder="Resumen del documento..."
            />
          </div>

          <div className="formField">
            <label htmlFor="abstract">Abstract</label>
            <textarea
              id="abstract"
              name="abstract"
              value={formData.abstract}
              onChange={handleInputChange}
              rows="6"
              placeholder="Abstract en inglés..."
            />
          </div>

          <div className="formField">
            <label htmlFor="citation">Citación</label>
            <textarea
              id="citation"
              name="citation"
              value={formData.citation}
              onChange={handleInputChange}
              rows="3"
              placeholder="Formato de citación..."
            />
          </div>
        </div>
      </form>
    </div>
  )
}

export default DocumentEdit