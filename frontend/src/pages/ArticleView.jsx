import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { articlesAPI } from '../api/api'
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'
import { recordViewedItem } from '../utils/viewHistory'
import '../styles/articles/ArticleViewEdit.css'

function ArticleView({
  previewMode = false,
  previewDocument = null,
  onLockedAction = null,
  activityScope = 'private',
  previewId = '',
}) {
  const { id } = useParams()
  const decodedId = decodeURIComponent(id || '')
  const resolvedId = decodeURIComponent(previewId || decodedId || '')
  const navigate = useNavigate()
  const location = useLocation()

  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  const [notification, setNotification] = useState('')

  useEffect(() => {
    if (previewMode) {
      if (previewDocument) {
        setDocument(previewDocument)
        setError(null)
      } else {
        setDocument(null)
        setError('Articulo no encontrado')
      }
      setLoading(false)
      return
    }

    const fetchDocument = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await articlesAPI.getById(resolvedId)
        setDocument(response.data)
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el articulo: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    if (resolvedId) {
      fetchDocument()
    } else {
      setError('ID de articulo no proporcionado')
      setLoading(false)
    }
  }, [previewDocument, previewMode, resolvedId])

  const articleId = document?._id || document?.id || resolvedId

  useEffect(() => {
    if (!document || !articleId) return

    recordViewedItem(
      {
        id: articleId,
        source: 'article',
        title: document.title || 'Sin titulo',
        year: document.year || null,
        category: document.category || '',
      },
      { scope: activityScope },
    )
  }, [activityScope, articleId, document])

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(''), 3000)
    return () => clearTimeout(timer)
  }, [notification])

  const handleEdit = () => {
    const encodedId = encodeURIComponent(resolvedId)
    if (previewMode) {
      navigate(`/preview/articles/${encodedId}/edit`)
      return
    }

    navigate(`/articles/${encodedId}/edit`, { state: location.state })
  }

  const handleBack = () => {
    if (previewMode) {
      navigate('/preview/articles')
      return
    }

    if (location.state?.from === 'dashboard') {
      navigate('/dashboard')
      return
    }

    if (location.state?.from === 'search') {
      navigate('/search')
      return
    }

    if (location.state?.from === 'collection' && location.state?.collectionId) {
      navigate(`/collections/${encodeURIComponent(location.state.collectionId)}`)
      return
    }

    navigate('/articles')
  }

  const handleCollectionsSuccess = (message) => {
    setShowCollectionsModal(false)
    setNotification(message || 'Articulo anadido a colecciones correctamente')
  }

  const handleOpenCollections = () => {
    if (previewMode) {
      onLockedAction?.('collections')
      return
    }

    setShowCollectionsModal(true)
  }

  if (loading) {
    return (
      <div className="documentViewContainer">
        <div className="loading">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--main_color)' }}></i>
          <p>Cargando articulo...</p>
        </div>
      </div>
    )
  }

  if (error || (!loading && !document)) {
    return (
      <div className="documentViewContainer">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error || 'Articulo no encontrado'}</p>
          <button onClick={handleBack} className="btn-secondary">
            {previewMode ? 'Volver a la demo' : 'Volver a Articulos'}
          </button>
        </div>
      </div>
    )
  }

  const authorsText = Array.isArray(document.authors)
    ? document.authors.join(', ')
    : (document.authors || 'No especificado')

  const keywordsText = Array.isArray(document.keywords)
    ? document.keywords
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && item.key) return item.key
          if (item && item.display_name) return item.display_name
          return ''
        })
        .filter(Boolean)
        .join(', ')
    : (typeof document.keywords === 'string' ? document.keywords : '')

  const abstractText = (document.abstract || '').trim()
  const hasAbstract = Boolean(abstractText)
  const referencedWorks = Array.isArray(document.referenced_works) ? document.referenced_works : []
  const relatedWorks = Array.isArray(document.related_works) ? document.related_works : []
  const countsByYear = Array.isArray(document.counts_by_year) ? document.counts_by_year : []

  return (
    <div className="documentViewContainer">
      <div className="documentContent">
        <div className="documentSection">
          <div className="documentTitleSection">
            <h1 className="documentTitle" style={{ color: 'var(--main_color)' }}>
              {document.title || 'Sin titulo'}
            </h1>
            <div className="documentNavigation">
              <button onClick={handleBack} className="btn-secondary">
                <i className="fas fa-arrow-left"></i>
                Volver
              </button>
              <button onClick={handleOpenCollections} className="btn-secondary">
                <i className={`fas ${previewMode ? 'fa-lock' : 'fa-layer-group'}`}></i>
                Anadir a coleccion
              </button>
              <button onClick={handleEdit} className="btn-primary">
                <i className="fas fa-edit"></i>
                Editar
              </button>
            </div>
          </div>
        </div>

        <div className="documentSection">
          <h3>Informacion General</h3>
          <div className="documentField">
            <label>Autor(es):</label>
            <span>{authorsText}</span>
          </div>
          <div className="documentField">
            <label>Anio:</label>
            <span>{document.year || 'No especificado'}</span>
          </div>
          <div className="documentField">
            <label>Categoria:</label>
            <span>{document.category || 'No especificado'}</span>
          </div>
          <div className="documentField">
            <label>Paginas:</label>
            <span>{document.pages || 'No especificado'}</span>
          </div>
          {document.type && (
            <div className="documentField">
              <label>Tipo:</label>
              <span>{document.type}</span>
            </div>
          )}
          {document.relevance_score !== null && document.relevance_score !== undefined && (
            <div className="documentField">
              <label>Relevancia:</label>
              <span>{document.relevance_score}</span>
            </div>
          )}
          {keywordsText && (
            <div className="documentField">
              <label>Palabras Clave:</label>
              <span>{keywordsText}</span>
            </div>
          )}
          {document.doi && (
            <div className="documentField">
              <label>DOI:</label>
              <span>{document.doi}</span>
            </div>
          )}
          {document.pdf_url && (
            <div className="documentField">
              <label>PDF URL:</label>
              <a href={document.pdf_url} target="_blank" rel="noopener noreferrer">
                {document.pdf_url}
              </a>
            </div>
          )}
          {document.landing_page_url && (
            <div className="documentField">
              <label>Landing Page:</label>
              <a href={document.landing_page_url} target="_blank" rel="noopener noreferrer">
                {document.landing_page_url}
              </a>
            </div>
          )}
          {document.status && (
            <div className="documentField">
              <label>Estado:</label>
              <span>{document.status}</span>
            </div>
          )}
        </div>

        {hasAbstract && (
          <div className="documentSection">
            <h3>Abstract</h3>
            <p className="documentAbstract">{abstractText}</p>
          </div>
        )}

        {Array.isArray(document.keywords) && document.keywords.length > 0 && (
          <div className="documentSection">
            <h3>Keywords</h3>
            <div className="documentKeywords">
              {document.keywords.map((item, index) => {
                const key = typeof item === 'string' ? item : (item?.key || item?.display_name || '')
                const score = typeof item === 'object' && item ? item.score : null
                if (!key) return null
                return (
                  <span key={`${key}-${index}`} className="keyword-badge">
                    {score !== null && score !== undefined ? `${key} (${Number(score).toFixed(2)})` : key}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {countsByYear.length > 0 && (
          <div className="documentSection">
            <h3>Citas por Anio</h3>
            <div className="documentReferences">
              {countsByYear.map((entry, index) => (
                <p key={`${entry?.year || 'y'}-${index}`}>
                  {entry?.year || '-'}: {entry?.cited_by_count ?? 0}
                </p>
              ))}
            </div>
          </div>
        )}

        {referencedWorks.length > 0 && (
          <div className="documentSection">
            <h3>Obras Referenciadas</h3>
            <div className="documentReferences">
              {referencedWorks.map((item, index) => (
                <p key={`ref-${index}`}>{item}</p>
              ))}
            </div>
          </div>
        )}

        {relatedWorks.length > 0 && (
          <div className="documentSection">
            <h3>Obras Relacionadas</h3>
            <div className="documentReferences">
              {relatedWorks.map((item, index) => (
                <p key={`rel-${index}`}>{item}</p>
              ))}
            </div>
          </div>
        )}

        {document.bibliography && (
          <div className="documentSection">
            <h3>Bibliografia</h3>
            <div className="documentReferences">
              <p>{document.bibliography}</p>
            </div>
          </div>
        )}
      </div>

      {!previewMode && (
        <SaveToCollectionsModal
          isOpen={showCollectionsModal}
          onClose={() => setShowCollectionsModal(false)}
          articleIds={[articleId]}
          onSuccess={handleCollectionsSuccess}
        />
      )}

      {notification && (
        <div className="upload-success-notification">
          <i className="fas fa-check-circle"></i>
          <span>{notification}</span>
        </div>
      )}
    </div>
  )
}

export default ArticleView
