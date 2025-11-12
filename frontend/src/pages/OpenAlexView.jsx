import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { openalexAPI } from '../api/api'
import '../styles/articles/ArticleViewEdit.css'

const OpenAlexView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Decodificar el ID que viene de la URL
  const decodedId = decodeURIComponent(id)

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await openalexAPI.getById(decodedId)
        console.log('Artículo OpenAlex recibido:', response.data)
        setDocument(response.data)
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el artículo: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    if (decodedId) {
      fetchDocument()
    } else {
      setError('ID de artículo no proporcionado')
      setLoading(false)
    }
  }, [decodedId])

  const handleEdit = () => {
    navigate(`/openalex/${encodeURIComponent(decodedId)}/edit`)
  }

  const handleBack = () => {
    navigate('/openalex')
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
            Volver a OpenAlex
          </button>
        </div>
      </div>
    )
  }

  // Procesar campos de OpenAlex
  const title = document.title || 'Sin título'
  const year = document.year || document.publication_year || 'No especificado'
  const category = document.category || (document.primary_topic?.display_name) || 'No especificado'
  const citations = document.citations || document.cited_by_count || 0
  const doi = document.doi || document.link || ''
  const type = document.type || 'No especificado'
  
  // Procesar autores
  let authors = 'No especificado'
  if (document.authorships && Array.isArray(document.authorships)) {
    authors = document.authorships
      .map(authorship => authorship.author?.display_name || '')
      .filter(name => name)
      .join(', ') || 'No especificado'
  } else if (document.authors) {
    authors = document.authors
  }

  // Procesar abstract
  let abstract = ''
  if (document.abstract_inverted_index) {
    // Convertir abstract_inverted_index a texto
    const words = []
    for (const [word, positions] of Object.entries(document.abstract_inverted_index)) {
      for (const pos of positions) {
        words[pos] = word
      }
    }
    abstract = words.filter(w => w).join(' ')
  } else if (document.abstract) {
    abstract = document.abstract
  }

  return (
    <div className="documentViewContainer">
      <div className="documentContent">
        <div className="documentSection">
          <div className="documentTitleSection">
            <h1 className="documentTitle" style={{ color: 'var(--main_color)' }}>
              {title}
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
            <span>{authors}</span>
          </div>
          <div className="documentField">
            <label>Año:</label>
            <span>{year}</span>
          </div>
          <div className="documentField">
            <label>Categoría:</label>
            <span>{category}</span>
          </div>
          {document.pages && (
            <div className="documentField">
              <label>Páginas:</label>
              <span>{document.pages}</span>
            </div>
          )}
          <div className="documentField">
            <label>Tipo:</label>
            <span>{type}</span>
          </div>
          <div className="documentField">
            <label>Citas:</label>
            <span>{citations}</span>
          </div>
          {doi && (
            <div className="documentField">
              <label>DOI/Enlace:</label>
              <a href={doi.startsWith('http') ? doi : `https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer">
                {doi}
              </a>
            </div>
          )}
        </div>

        {abstract && (
          <div className="documentSection">
            <h3>Resumen</h3>
            <p className="documentAbstract">{abstract}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default OpenAlexView
