import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesAPI } from '../api/api'
import '../styles/articles/ArticleViewEdit.css'

function normalizeToFormData(document = {}) {
  return {
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
    authors: Array.isArray(document.authors) ? document.authors.join(', ') : document.authors || '',
  }
}

function ArticleEdit({ previewMode = false, previewDocument = null, onLockedAction = null, previewId = '' }) {
  const { id } = useParams()
  const decodedId = decodeURIComponent(previewId || id || '')
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
    if (previewMode) {
      if (previewDocument) {
        setFormData(normalizeToFormData(previewDocument))
        setError(null)
      } else {
        setError('Articulo no encontrado')
      }
      setLoading(false)
      return
    }

    const fetchDocument = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await articlesAPI.getById(decodedId)
        setFormData(normalizeToFormData(response.data))
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el articulo: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    if (decodedId) {
      fetchDocument()
    } else {
      setError('ID de articulo no proporcionado')
      setLoading(false)
    }
  }, [decodedId, previewDocument, previewMode])

  const handleInputChange = (event) => {
    if (previewMode) return

    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async () => {
    if (previewMode) {
      onLockedAction?.('edit')
      return
    }

    try {
      setSaving(true)

      const sanitizedData = Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [key, value === '' ? null : value]),
      )

      await articlesAPI.update(decodedId, sanitizedData)
      navigate(`/articles/${encodeURIComponent(decodedId)}`)
    } catch (err) {
      console.error('Error saving document:', err)
      setError('Error al guardar el articulo')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (previewMode) {
      navigate(`/preview/articles/${encodeURIComponent(decodedId)}`)
      return
    }

    navigate(`/articles/${encodeURIComponent(decodedId)}`)
  }

  const handleDelete = async () => {
    if (previewMode) {
      onLockedAction?.('edit')
      return
    }

    try {
      await articlesAPI.delete(decodedId)
      navigate('/articles')
    } catch (err) {
      console.error('Error deleting article:', err)
      setError('Error al eliminar el articulo')
      setShowDeleteModal(false)
    }
  }

  if (loading) {
    return (
      <div className="documentEditContainer">
        <div className="loading">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--main_color)' }}></i>
          <p>Cargando articulo...</p>
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
          <button onClick={handleCancel} className="btn-secondary">
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="documentEditContainer">
      <div className="documentHeader">
        <h1 style={{ color: 'var(--main_color)' }}>{previewMode ? 'Editar Articulo (solo lectura)' : 'Editar Articulo'}</h1>
        <div className="documentActions">
          <button onClick={handleCancel} className="btn-secondary" disabled={saving}>
            Cancelar
          </button>
          <button onClick={handleSave} className="btn-primary" disabled={saving || previewMode}>
            {previewMode ? 'Bloqueado' : saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <form className="documentForm" onSubmit={(event) => event.preventDefault()}>
        <div className="formSection formSectionFirst">
          <h3>Informacion Basica</h3>

          <div className="formField">
            <label htmlFor="title">Titulo *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              disabled={previewMode}
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
              placeholder="Separar multiples autores con comas"
              disabled={previewMode}
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
                disabled={previewMode}
              />
            </div>

            <div className="formField">
              <label htmlFor="category">Categoria</label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Ej: Technology, Healthcare"
                disabled={previewMode}
              />
            </div>
          </div>
        </div>

        <div className="formSection">
          <h3>Detalles de Publicacion</h3>

          <div className="formField">
            <label htmlFor="type">Tipo</label>
            <input
              type="text"
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              placeholder="Ej: Research Article, Conference Paper"
              disabled={previewMode}
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
                disabled={previewMode}
              />
            </div>

            <div className="formField">
              <label htmlFor="pages">Paginas</label>
              <input
                type="text"
                id="pages"
                name="pages"
                value={formData.pages}
                onChange={handleInputChange}
                placeholder="Ej: 123-145"
                disabled={previewMode}
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
              disabled={previewMode}
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
              disabled={previewMode}
            />
          </div>
        </div>

        <div className="formSection">
          <h3>Contenido</h3>

          <div className="formField">
            <label htmlFor="summary">Resumen (EspAñol)</label>
            <textarea
              id="summary"
              name="summary"
              value={formData.summary}
              onChange={handleInputChange}
              rows="6"
              placeholder="Resumen en espAñol..."
              disabled={previewMode}
            />
          </div>

          <div className="formField">
            <label htmlFor="abstract">Abstract (Ingles)</label>
            <textarea
              id="abstract"
              name="abstract"
              value={formData.abstract}
              onChange={handleInputChange}
              rows="6"
              placeholder="Abstract en ingles..."
              disabled={previewMode}
            />
          </div>
        </div>
      </form>

      <div
        style={{
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'center',
          maxWidth: '1200px',
          margin: '1rem auto 0',
          padding: '0 2rem',
        }}
      >
        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn-primary btn-delete-article"
          disabled={saving || previewMode}
          style={{
            minWidth: '250px',
            padding: '12px 24px',
            fontSize: '1rem',
          }}
        >
          <i className="fas fa-trash" style={{ marginRight: '0.5rem' }}></i>
          {previewMode ? 'Bloqueado en demo' : 'Eliminar Articulo'}
        </button>
      </div>

      {!previewMode && showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-exclamation-triangle" style={{ color: 'var(--color-danger)' }}></i>
                {' '}Confirmar Eliminacion
              </h2>
            </div>
            <div className="modal-body">
              <p>Estas seguro de que quieres eliminar este articulo?</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Esta accion no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleDelete} className="btn-primary">
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
