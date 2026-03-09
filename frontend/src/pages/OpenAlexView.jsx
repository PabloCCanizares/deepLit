import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collectionsAPI, openalexAPI } from '../api/api'
import { useCollection } from '../context/CollectionContext'
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'
import { invalidateOpenAlexMembershipQueries } from '../utils/openalexMembershipQueries'
import { recordViewedItem } from '../utils/viewHistory'
import { getOpenAlexArticleStatus } from '../components/openalex/openalexStatus'
import '../styles/openalex/OpenAlexView.css'

function OpenAlexView({
  previewMode = false,
  previewDocument = null,
  onLockedAction = null,
  activityScope = 'private',
  previewId = '',
}) {
  const { id } = useParams()
  const openalexId = decodeURIComponent(previewId || id || '')
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedCollectionId, collections } = useCollection()
  const queryClient = useQueryClient()

  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [savingCurrent, setSavingCurrent] = useState(false)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  const [notification, setNotification] = useState('')

  const { data: libraryData } = useQuery({
    queryKey: ['libraryArticleIds'],
    queryFn: async () => {
      const response = await collectionsAPI.getLibraryIds()
      return response.data
    },
    enabled: !previewMode,
  })

  const { data: collectionData } = useQuery({
    queryKey: ['collectionArticleIds', selectedCollectionId],
    queryFn: async () => {
      if (!selectedCollectionId) return { article_ids: [] }
      const response = await collectionsAPI.getIdsbyCollection(selectedCollectionId)
      return response.data
    },
    enabled: !previewMode && Boolean(selectedCollectionId),
  })

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

        const response = await openalexAPI.getById(openalexId)
        setDocument(response.data)
      } catch (err) {
        console.error('Error fetching document:', err)
        setError(`Error al cargar el articulo: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    if (openalexId) {
      fetchDocument()
    } else {
      setError('ID de articulo no proporcionado')
      setLoading(false)
    }
  }, [openalexId, previewDocument, previewMode])

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(''), 3000)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    if (!document || !openalexId) return

    recordViewedItem(
      {
        id: openalexId,
        source: 'openalex',
        title: document.title || 'Sin titulo',
        year: document.year || document.publication_year || null,
        category: document.category || document.primary_topic?.display_name || '',
      },
      { scope: activityScope },
    )
  }, [activityScope, document, openalexId])

  const handleBack = () => {
    if (previewMode) {
      navigate('/preview/openalex')
      return
    }

    if (location.state?.from === 'dashboard') {
      navigate('/dashboard')
      return
    }

    sessionStorage.setItem('openalex_from_detail', 'true')
    navigate('/openalex')
  }

  const handleSaveToCurrentCollection = async () => {
    if (previewMode) {
      onLockedAction?.('openalex')
      return
    }

    try {
      setSavingCurrent(true)
      let message = ''

      if (selectedCollectionId) {
        if (isInCurrentCollection) {
          await collectionsAPI.removeArticle(selectedCollectionId, openalexId)
          message = `Artículo quitado de "${selectedCollectionName}"`
        } else if (isInLibrary) {
          await collectionsAPI.addArticle(selectedCollectionId, openalexId)
          message = `Artículo añadido a "${selectedCollectionName}"`
        } else {
          await openalexAPI.saveWork(openalexId, selectedCollectionId)
          message = `Artículo guardado y añadido a "${selectedCollectionName}"`
        }
      } else if (isInLibrary) {
        await openalexAPI.unsaveWork(openalexId)
        message = 'Artículo quitado de tu biblioteca'
      } else {
        await openalexAPI.saveWork(openalexId)
        message = 'Artículo guardado en tu biblioteca'
      }

      await invalidateOpenAlexMembershipQueries(queryClient)
      setNotification(message)
    } catch (err) {
      setNotification(err.message || 'Error al guardar el articulo')
    } finally {
      setSavingCurrent(false)
    }
  }

  const handleCollectionsSuccess = (message) => {
    setShowCollectionsModal(false)
    setNotification(message || 'Articulo guardado en colecciones')
    invalidateOpenAlexMembershipQueries(queryClient)
  }

  const handleOpenCollections = () => {
    if (previewMode) {
      onLockedAction?.('openalex')
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
            {previewMode ? 'Volver a la demo' : 'Volver a OpenAlex'}
          </button>
        </div>
      </div>
    )
  }

  const title = document.title || 'Sin titulo'
  const selectedCollection = collections.find((collection) => collection._id === selectedCollectionId)
  const selectedCollectionName = selectedCollection?.name || 'la colección activa'
  const libraryArticleIds = libraryData?.article_ids || []
  const currentCollectionArticleIds = collectionData?.article_ids || []
  const isInLibrary = libraryArticleIds.includes(openalexId)
  const isInCurrentCollection =
    Boolean(selectedCollectionId) && currentCollectionArticleIds.includes(openalexId)
  const actionStatus = getOpenAlexArticleStatus({
    inLibrary: isInLibrary,
    inCurrentCollection: isInCurrentCollection,
    hasActiveCollection: Boolean(selectedCollectionId),
    collectionName: selectedCollectionName,
  })
  const year = document.year || document.publication_year || 'No especificado'
  const category = document.category || document.primary_topic?.display_name || 'No especificado'
  const citations = document.citations || document.cited_by_count || 0
  const doi = document.doi || document.link || ''
  const type = document.type || 'No especificado'
  const pdfUrl = document.pdf_url || null
  const landingPageUrl = document.landing_page_url || null

  let authors = 'No especificado'
  if (document.authorships && Array.isArray(document.authorships)) {
    authors =
      document.authorships
        .map((authorship) => authorship.author?.display_name || '')
        .filter((name) => name)
        .join(', ') || 'No especificado'
  } else if (document.authors) {
    authors = document.authors
  }

  let abstract = ''
  if (document.abstract_inverted_index) {
    const words = []
    for (const [word, positions] of Object.entries(document.abstract_inverted_index)) {
      for (const pos of positions) {
        words[pos] = word
      }
    }
    abstract = words.filter((word) => word).join(' ')
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
              <button onClick={handleSaveToCurrentCollection} className="btn-secondary" disabled={!previewMode && savingCurrent}>
                <i className={savingCurrent ? 'fas fa-spinner fa-spin' : actionStatus.actionIcon}></i>
                {previewMode
                  ? 'Iniciar sesion para guardar'
                  : savingCurrent
                  ? 'Guardando...'
                  : actionStatus.actionLabel}
              </button>
              <button onClick={handleOpenCollections} className="btn-primary">
                <i className={`fas ${previewMode ? 'fa-lock' : 'fa-layer-group'}`}></i>
                {previewMode ? 'Iniciar sesion para colecciones' : 'Anadir a colecciones'}
              </button>
            </div>
          </div>
        </div>

        <div className="documentSection">
          <h3>Informacion General</h3>
          <div className="documentField">
            <label>Autor(es):</label>
            <span>{authors}</span>
          </div>
          <div className="documentField">
            <label>Año:</label>
            <span>{year}</span>
          </div>
          <div className="documentField">
            <label>Categoria:</label>
            <span>{category}</span>
          </div>
          {document.pages && (
            <div className="documentField">
              <label>Paginas:</label>
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
          <div className="documentField">
            <label>Enlace PDF:</label>
            {pdfUrl ? (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                {pdfUrl}
              </a>
            ) : (
              <span className="no-data">No hay PDF disponible</span>
            )}
          </div>
          <div className="documentField">
            <label>Ver articulo:</label>
            {landingPageUrl ? (
              <a href={landingPageUrl} target="_blank" rel="noopener noreferrer">
                {landingPageUrl}
              </a>
            ) : (
              <span className="no-data">No disponible</span>
            )}
          </div>
        </div>

        {abstract && (
          <div className="documentSection">
            <h3>Resumen</h3>
            <p className="documentAbstract">{abstract}</p>
          </div>
        )}
      </div>

      {!previewMode && (
        <SaveToCollectionsModal
          isOpen={showCollectionsModal}
          onClose={() => setShowCollectionsModal(false)}
          articleIds={[openalexId]}
          onSuccess={handleCollectionsSuccess}
        />
      )}

      {notification && (
        <div className={`upload-success-notification ${notification.toLowerCase().includes('error') ? 'error' : ''}`}>
          <i
            className={`fas ${notification.toLowerCase().includes('error') ? 'fa-exclamation-circle' : 'fa-check-circle'}`}
          ></i>
          <span>{notification}</span>
        </div>
      )}
    </div>
  )
}

export default OpenAlexView
