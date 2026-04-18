import { useState, useEffect, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { articlesAPI } from '../api/index.js'
import { useArticleFilters } from '../hooks/useArticleFilters'

import UnifiedFilterBar from '../components/common/UnifiedFilterBar'
import UploadOverlay from '../components/articles/UploadOverlay'
import ProcessingQueue from '../components/articles/ProcessingQueue'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import SelectionActions from '../components/articles/SelectionActions'
import Pagination from '../components/articles/Pagination'
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'
import { invalidateOpenAlexMembershipQueries } from '../utils/openalexMembershipQueries'

import '../styles/App.css'
import '../styles/articles/ArticleViewEdit.css'

function Articles() {
  const queryClient = useQueryClient()

  const [documents, setDocuments] = useState([])
  const [selectedArticles, setSelectedArticles] = useState([])

  const filters = useArticleFilters()
  const {
    searchQuery, sortCriteria, fieldFilters, viewMode, pagination,
    handleSearch, handleSort, handleFieldFilter,
    handleViewModeChange, resetFilters, setTotal, setPagination,
    activeFilterCount, buildApiFilters,
    currentPage, totalPages, setPage, nextPage, prevPage, setLimit,
  } = filters

  const [totalArticles, setTotalArticles] = useState(0) // Total sin filtros

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState([])
  const [modalArticleIds, setModalArticleIds] = useState([])

  const [isUploadOverlayOpen, setIsUploadOverlayOpen] = useState(false)
  const [isProcessingQueueOpen, setIsProcessingQueueOpen] = useState(false)
  const [notification, setNotification] = useState('')

  // Ref para SSE EventSource
  const eventSourceRef = useRef(null)

  const suggestions = useMemo(() => ({
    categories: [...new Set(documents.map(d => d.category).filter(Boolean))],
    types: [...new Set(documents.map(d => d.type).filter(Boolean))],
    authors: [...new Set(documents.flatMap(d => Array.isArray(d.authors) ? d.authors : []).filter(Boolean))],
    keywords: [...new Set(documents.flatMap(d => Array.isArray(d.keywords) ? d.keywords.map(k => typeof k === 'string' ? k : k.key).filter(Boolean) : []))],
  }), [documents])


  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(''), 4000)
    return () => clearTimeout(timer)
  }, [notification])


  // SSE: suscripción a eventos en tiempo real
  useEffect(() => {
    const es = articlesAPI.subscribeEvents({
      onArticleReady: (data) => {
        console.log('SSE: artículo procesado', data)
        setNotification(`"${data.title}" procesado correctamente`)
        // Recargar lista para mostrar el nuevo artículo
        loadDocuments()
      },
      onArticleError: (data) => {
        console.log('SSE: error en artículo', data)
        setNotification(`Error procesando "${data.title}": ${data.error_message || 'Error desconocido'}`)
      },
      onError: () => {
        console.warn('SSE: conexión perdida, reconectando...')
      }
    })

    eventSourceRef.current = es

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])


  useEffect(() => {
    loadDocuments()
  }, [
    pagination.offset,
    pagination.limit,
    searchQuery,
    sortCriteria,
    fieldFilters.yearMin,
    fieldFilters.yearMax,
    fieldFilters.category,
    fieldFilters.type,
    fieldFilters.author,
  ])

  useEffect(() => {
    setSelectedArticles([])
  }, [pagination.offset])



  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await articlesAPI.getArticles({
        limit: pagination.limit,
        offset: pagination.offset,
        filters: buildApiFilters(),
        sort_by: sortCriteria,
      });
      console.log("Respuesta de artículos:", response);

      setDocuments(response.data.articles)
      setTotalArticles(response.data.total)
      setTotal(response.data.total)
      console.log("Artículos recibidos:", response.data.articles.length, "Total del backend:", response.data.total);
    } catch (err) {
      setError(err.message || 'Error al cargar artículos')
    } finally {
      setLoading(false)
    }
  }


  // Handlers 

  {/* SELECCIÓN DE ARTÍCULOS*/ }

  const handleSelectArticle = (articleId) => {
    setSelectedArticles(prev =>
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    )
  }

  const handleSelectAll = () => {
    if (selectedArticles.length === documents.length) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(documents.map(doc => doc._id || doc.id))
    }
  }

  {/* SUBIR ARTÍCULOS*/ }

  const handleUploadSuccess = async (message) => {
    // Cerrar el overlay inmediatamente
    setIsUploadOverlayOpen(false)
    // Mostrar mensaje de éxito
    setNotification(message || 'Archivo(s) subido(s) correctamente')
    setPagination(prev => ({ ...prev, offset: 0 }))
    await loadDocuments();
  }

  {/* AÑADIR ARTÍCULOS A LAS COLECCIONES*/ }

  const handleAddToCollections = () => {
    if (selectedArticles.length === 0) return
    setModalArticleIds(selectedArticles)
    setShowCollectionsModal(true)
  }

  const handleAddSingleArticleToCollections = (articleId) => {
    setModalArticleIds([articleId])
    setShowCollectionsModal(true)
  }

  const handleCollectionsSuccess = (message) => {
    setShowCollectionsModal(false)
    setSelectedArticles([])
    setNotification(message || 'Artículos añadidos a colecciones correctamente')
  }


  {/* BORRADO DE ARTÍCULOS*/ }

  const handleDeleteArticle = (articleId) => {
    setPendingDeleteIds([articleId])
    setShowDeleteModal(true)
  }

  const handleDeleteSelected = async () => {
    if (selectedArticles.length === 0) return
    setPendingDeleteIds(selectedArticles)
    setShowDeleteModal(true)
  }

  const confirmDeleteSelected = async () => {

    const ids = pendingDeleteIds

    try {
      await Promise.all(ids.map(id => articlesAPI.delete(id)))
      setNotification(`${ids.length} artículo(s) eliminado(s)`)

      const newOffset =
        documents.length === ids.length && pagination.offset > 0
          ? pagination.offset - pagination.limit
          : pagination.offset

      setPagination(prev => ({ ...prev, offset: Math.max(0, newOffset) }))
    } catch (e) {
      setNotification('Error al eliminar artículos')
    } finally {
      setShowDeleteModal(false)
      setPendingDeleteIds([])
      setSelectedArticles([])
      await Promise.all([
        loadDocuments(),
        invalidateOpenAlexMembershipQueries(queryClient),
      ])
    }
  }

  return (
    <div className="page-container">
      <div className="container">

        {/* Header Panel - Formato común */}
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Biblioteca</h1>
              <span className="header-subtitle">
                Gestiona y organiza tu biblioteca de artículos
              </span>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{documents.length}</span>
                <span className="stat-label">Filtrados</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{totalArticles}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
          </div>
        </div>


        <div style={{ marginTop: '2rem' }}>
          {selectedArticles.length > 0 ? (
            <SelectionActions
              selectedCount={selectedArticles.length}
              onAddToCollections={handleAddToCollections}
              onDeleteSelected={handleDeleteSelected}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
          ) : (
            <UnifiedFilterBar {...filters} suggestions={suggestions} searchPlaceholder="Buscar por título" />
          )}
        </div>

        {viewMode === 'list' ? (
          <ArticleList
            documents={documents}
            loading={loading}
            error={error}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
            onAddToCollectionsSingle={handleAddSingleArticleToCollections}
            onDeleteArticle={handleDeleteArticle}
            sortCriteria={sortCriteria}
            onSort={handleSort}
          />
        ) : (
          <ArticleGrid
            documents={documents}
            loading={loading}
            error={error}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onAddToCollectionsSingle={handleAddSingleArticleToCollections}
            onDeleteArticle={handleDeleteArticle}
          />
        )}

        {/* Paginación debajo de los artículos */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={prevPage}
          onNext={nextPage}
          onPageChange={setPage}
        />

        {/* Botón flotante para subir artículos */}
        <button
          className="floating-upload-button"
          onClick={() => setIsUploadOverlayOpen(true)}
          title="Subir artículos"
        >
          <i className="fas fa-cloud-upload-alt"></i>
        </button>

        {/* Botón para visualizar cola de procesamiento */}
        <button
          className="floating-queue-button"
          onClick={() => setIsProcessingQueueOpen(true)}
          title="Ver cola de procesamiento"
        >
          <i className="fas fa-hourglass-half"></i>
        </button>

        {/* Overlay de subida */}
        <UploadOverlay
          isOpen={isUploadOverlayOpen}
          onClose={() => setIsUploadOverlayOpen(false)}
          onUploadSuccess={handleUploadSuccess}
        />

        {/* Modal de cola de procesamiento */}
        <ProcessingQueue
          isOpen={isProcessingQueueOpen}
          onClose={() => setIsProcessingQueueOpen(false)}
        />

        {/* Mensaje de éxito de carga */}
        {notification && (
          <div className={`upload-success-notification ${notification.toLowerCase().includes('error') ? 'error' : ''}`}>
            <i className={`fas ${notification.toLowerCase().includes('error') ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
            <span>{notification}</span>
          </div>
        )}

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
                <p>¿Estás seguro de que quieres eliminar {pendingDeleteIds.length > 0 ? pendingDeleteIds.length : selectedArticles.length} artículo(s)?</p>
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
                  onClick={confirmDeleteSelected}
                  className="btn-primary"
                >
                  <i className="fas fa-trash" style={{ marginRight: '0.5rem' }}></i>
                  Eliminar Definitivamente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de añadir a colecciones */}
        <SaveToCollectionsModal
          isOpen={showCollectionsModal}
          onClose={() => setShowCollectionsModal(false)}
          articleIds={modalArticleIds}
          onSuccess={handleCollectionsSuccess}
        />
      </div>
    </div>
  )
}

export default Articles
