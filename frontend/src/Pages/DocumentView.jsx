import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { articlesAPI } from '../Api/articlesAPI.js'
import '../styles/Documents/DocumentViewEdit.css'

const DocumentView = () => {
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
        console.log('Fetching document with ID:', id)
        console.log('articlesAPI available methods:', Object.keys(articlesAPI))
        
        // Verificar si la función existe
        if (!articlesAPI.getById) {
          throw new Error('articlesAPI.getById no está disponible')
        }

        // También obtener la lista de documentos disponibles para debug
        if (articlesAPI.getMockDocuments) {
          const availableDocs = articlesAPI.getMockDocuments();
          console.log('Available document IDs:', availableDocs.map(doc => ({ id: doc.id, title: doc.title })));
        }
        
        const response = await articlesAPI.getById(id)
        console.log('Response received:', response)
        
        if (!response || !response.data) {
          throw new Error('Respuesta inválida del servidor')
        }
        
        setDocument(response.data)
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el documento: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchDocument()
    } else {
      setError('ID de documento no proporcionado')
      setLoading(false)
    }
  }, [id])

  const handleEdit = () => {
    navigate(`/documents/${id}/edit`)
  }

  const handleBack = () => {
    navigate('/documents')
  }

  if (loading) {
    return (
      <div className="documentViewContainer">
        <div className="loading">
          <i className="fas fa-spinner"></i>
          <p>Cargando documento...</p>
        </div>
      </div>
    )
  }

  if (error || (!loading && !document)) {
    return (
      <div className="documentViewContainer">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error || 'Documento no encontrado'}</p>
          <button onClick={handleBack} className="btn-secondary">
            Volver a Documentos
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
            <span>{document.authors || 'No especificado'}</span>
          </div>
          <div className="documentField">
            <label>Año:</label>
            <span>{document.year || 'No especificado'}</span>
          </div>
          <div className="documentField">
            <label>Revista/Fuente:</label>
            <span>{document.journal || 'No especificado'}</span>
          </div>
        </div>

        {document.abstract && (
          <div className="documentSection">
            <h3>Resumen</h3>
            <p className="documentAbstract">{document.abstract}</p>
          </div>
        )}

        {document.keywords && (
          <div className="documentSection">
            <h3>Palabras Clave</h3>
            <div className="documentKeywords">
              {document.keywords.split(',').map((keyword, index) => (
                <span key={index} className="keyword-badge">
                  {keyword.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {document.references && (
          <div className="documentSection">
            <h3>Referencias</h3>
            <div className="documentReferences">
              <p>{document.references}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentView