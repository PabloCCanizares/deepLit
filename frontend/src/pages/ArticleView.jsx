import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesAPI } from '../api/api'
import '../styles/articles/ArticleViewEdit.css'

const ArticleView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await articlesAPI.getById(id)
        setDocument(response.data)
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el artículo: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchDocument()
    } else {
      setError('ID de artículo no proporcionado')
      setLoading(false)
    }
  }, [id])

  const handleEdit = () => {
    navigate(`/articles/${id}/edit`)
  }

  const handleBack = () => {
    navigate('/articles')
  }

  if (loading) {
    return (
      <div className="documentViewContainer">
        <div className="loading">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--main_color)' }}></i>
          <p>Cargando artículo...</p>
        </div>
      </div>
    )
  }

  if (error || (!loading && !document)) {
    return (
      <div className="documentViewContainer">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error || 'Artículo no encontrado'}</p>
          <button onClick={handleBack} className="btn-secondary">
            Volver a Artículos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="documentViewContainer">
      <div className="documentContent">
        <div className="documentSection">
          <div className="documentTitleSection">
            <h1 className="documentTitle" style={{ color: 'var(--main_color)' }}>
              {document.title || 'Sin título'}
            </h1>
            <div className="documentNavigation">
              <button onClick={handleBack} className="btn-secondary">
                <i className="fas fa-arrow-left"></i>
                Volver
              </button>
              <button onClick={handleEdit} className="btn-primary">
                <i className="fas fa-edit"></i>
                Editar
              </button>
            </div>
          </div>
        </div>

        <div className="documentSection">
          <h3>Información General</h3>
          <div className="documentField">
            <label>Autor(es):</label>
            <span>
              {Array.isArray(document.authors)
                ? document.authors.join(', ')
                : (document.authors || 'No especificado')}
            </span>
          </div>
          <div className="documentField">
            <label>Año:</label>
            <span>{document.year || 'No especificado'}</span>
          </div>
          <div className="documentField">
            <label>Categoría:</label>
            <span>{document.category || 'No especificado'}</span>
          </div>
          <div className="documentField">
            <label>Páginas:</label>
            <span>{document.pages || 'No especificado'}</span>
          </div>
          {document.type && (
            <div className="documentField">
              <label>Tipo:</label>
              <span>{document.type}</span>
            </div>
          )}
          {document.keywords && document.keywords.length > 0 && (
            <div className="documentField">
              <label>Palabras Clave:</label>
              <span>
                {Array.isArray(document.keywords)
                  ? document.keywords
                      .map(item => {
                        // Manejar diferentes formatos de keywords
                        if (typeof item === 'string') return item;
                        if (item && item.key) return item.key;
                        if (item && item.display_name) return item.display_name;
                        return String(item);
                      })
                      .filter(k => k) // Eliminar valores vacíos
                      .join(', ')
                  : 'No especificado'}
              </span>
            </div>
          )}
          {document.acronym && (
            <div className="documentField">
              <label>Acrónimo:</label>
              <span>{document.acronym}</span>
            </div>
          )}
          {document.citations && (
            <div className="documentField">
              <label>Citas:</label>
              <span>{document.citations}</span>
            </div>
          )}
          {document.link && (
            <div className="documentField">
              <label>Enlace:</label>
              <a href={document.link} target="_blank" rel="noopener noreferrer">
                {document.link}
              </a>
            </div>
          )}
        </div>

        {(document.summary || document.abstract) && (
          <div className="documentSection">
            <h3>Resumen</h3>
            <p className="documentAbstract">{document.summary || document.abstract}</p>
          </div>
        )}

        {document.abstract && document.summary && (
          <div className="documentSection">
            <h3>Abstract</h3>
            <p className="documentAbstract">{document.abstract}</p>
          </div>
        )}

        {document.observations && (
          <div className="documentSection">
            <h3>Observaciones</h3>
            <p className="documentAbstract">{document.observations}</p>
          </div>
        )}

        {document.bibliography && (
          <div className="documentSection">
            <h3>Bibliografía</h3>
            <div className="documentReferences">
              <p>{document.bibliography}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ArticleView