import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { collectionsAPI } from '../api/index.js'
import { useArticleFilters } from '../hooks/useArticleFilters'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import { useArticlesListQuery } from '../hooks/useArticlesListQuery'
import { useTimedNotification } from '../hooks/useTimedNotification'
import { useCollection } from '../context/CollectionContext'

import UnifiedFilterBar from '../components/common/UnifiedFilterBar'
import NotificationToast from '../components/common/NotificationToast'
import UploadOverlay from '../components/articles/UploadOverlay'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import SelectionActions from '../components/articles/SelectionActions'
import Pagination from '../components/articles/Pagination'
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'
import { invalidateOpenAlexMembershipQueries } from '../utils/openalexMembershipQueries'
import { shouldDisplayProcessingEvent } from '../utils/processingEventDedup'

import '../styles/App.css'
import '../styles/articles/ArticleViewEdit.css'

function CollectionArticles() {
  const { selectedCollectionId, collections } = useCollection()
  const queryClient = useQueryClient()
  const [selectedArticles, setSelectedArticles] = useState([])

  const filters = useArticleFilters()
  const {
    sortCriteria,
    viewMode,
    pagination,
    handleSort,
    handleViewModeChange,
    setTotal,
    setPagination,
    buildApiFilters,
    currentPage,
    totalPages,
    setPage,
    nextPage,
    prevPage,
  } = filters

  const selectedCollection = collections.find((collection) => collection._id === selectedCollectionId)
  const collectionName = selectedCollection ? selectedCollection.name : null

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState([])
  const [modalArticleIds, setModalArticleIds] = useState([])
  const [isUploadOverlayOpen, setIsUploadOverlayOpen] = useState(false)
  const { notification, setNotification, clearNotification } = useTimedNotification()

  const apiFilters = useMemo(() => buildApiFilters(), [buildApiFilters])
  const {
    data: articlesResponse,
    isLoading,
    isFetching,
    error: queryError,
  } = useArticlesListQuery({
    collectionId: selectedCollectionId || null,
    limit: pagination.limit,
    offset: pagination.offset,
    filters: apiFilters,
    sortBy: sortCriteria,
    enabled: Boolean(selectedCollectionId),
  })

  const documents = articlesResponse?.data?.articles || []
  const totalArticles = articlesResponse?.data?.total || 0
  const loading = isLoading || isFetching
  const error = queryError?.message || null

  const suggestions = useMemo(() => ({
    categories: [...new Set(documents.map((document) => document.category).filter(Boolean))],
    types: [...new Set(documents.map((document) => document.type).filter(Boolean))],
    authors: [...new Set(documents.flatMap((document) => Array.isArray(document.authors) ? document.authors : []).filter(Boolean))],
    keywords: [...new Set(documents.flatMap((document) => Array.isArray(document.keywords) ? document.keywords.map((keyword) => typeof keyword === 'string' ? keyword : keyword.key).filter(Boolean) : []))],
  }), [documents])

  useEffect(() => {
    setTotal(totalArticles)
  }, [setTotal, totalArticles])

  useEffect(() => {
    setSelectedArticles([])
  }, [pagination.offset])

  useArticlesEvents({
    onArticleReady: async (data) => {
      if (shouldDisplayProcessingEvent({ eventName: 'article_ready', data })) {
        setNotification(`"${data.title}" procesado correctamente`)
      }
      await queryClient.invalidateQueries({ queryKey: ['articles', 'list'] })
    },
    onArticleError: (data) => {
      if (shouldDisplayProcessingEvent({ eventName: 'article_error', data })) {
        setNotification(`Error procesando "${data.title}": ${data.error_message || 'Error desconocido'}`)
      }
    },
  }, Boolean(selectedCollectionId))

  if (!selectedCollectionId) {
    return (
      <div className="page-container collection-empty-state-page">
        <div className="collection-empty-state-card">
          <div className="collection-empty-state-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <h1>Selecciona una colección</h1>
          <p>Zona de trabajo opera sobre una colección concreta. Si quieres ver todo, usa Biblioteca.</p>
        </div>
      </div>
    )
  }

  const handleSelectArticle = (articleId) => {
    setSelectedArticles((previous) =>
      previous.includes(articleId)
        ? previous.filter((id) => id !== articleId)
        : [...previous, articleId]
    )
  }

  const handleSelectAll = () => {
    if (selectedArticles.length === documents.length) {
      setSelectedArticles([])
      return
    }

    setSelectedArticles(documents.map((document) => document._id || document.id))
  }

  const handleUploadSuccess = async (message) => {
    setIsUploadOverlayOpen(false)
    setNotification(message || 'Archivo(s) subido(s) correctamente')
    setPagination((previous) => ({ ...previous, offset: 0 }))
    await queryClient.invalidateQueries({ queryKey: ['articles', 'list'] })
  }

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

    if (!selectedCollectionId || ids.length === 0) {
      setShowDeleteModal(false)
      setPendingDeleteIds([])
      return
    }

    try {
      await Promise.all(ids.map((id) => collectionsAPI.removeArticle(selectedCollectionId, id)))
      setNotification(`${ids.length} artículo(s) quitado(s) de la colección`)

      const newOffset =
        documents.length === ids.length && pagination.offset > 0
          ? pagination.offset - pagination.limit
          : pagination.offset

      setPagination((previous) => ({ ...previous, offset: Math.max(0, newOffset) }))
    } catch {
      setNotification('Error al quitar artículos de la colección')
    } finally {
      await Promise.all([
        invalidateOpenAlexMembershipQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['articles', 'list'] }),
      ])
      setShowDeleteModal(false)
      setPendingDeleteIds([])
      setSelectedArticles([])
    }
  }

  return (
    <div className="page-container">
      <div className="container">
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Artículos de "{collectionName}"</h1>
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
            linkState={{ from: 'search', collectionId: selectedCollectionId }}
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
            linkState={{ from: 'search', collectionId: selectedCollectionId }}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onAddToCollectionsSingle={handleAddSingleArticleToCollections}
            onDeleteArticle={handleDeleteArticle}
          />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={prevPage}
          onNext={nextPage}
          onPageChange={setPage}
        />

        <button
          className="floating-upload-button"
          onClick={() => setIsUploadOverlayOpen(true)}
        >
          <i className="fas fa-cloud-upload-alt"></i>
        </button>

        <UploadOverlay
          isOpen={isUploadOverlayOpen}
          onClose={() => setIsUploadOverlayOpen(false)}
          onUploadSuccess={handleUploadSuccess}
          collection_id={selectedCollectionId}
        />

        <NotificationToast message={notification} onClose={clearNotification} />

        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <i className="fas fa-exclamation-triangle" style={{ color: 'var(--color-danger)' }}></i>
                  {' '}Quitar de la colección
                </h2>
              </div>
              <div className="modal-body">
                <p>¿Estás seguro de que quieres quitar {pendingDeleteIds.length > 0 ? pendingDeleteIds.length : selectedArticles.length} artículo(s) de esta colección?</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Los artículos seguirán existiendo en tu biblioteca y en otras colecciones.
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
                  Quitar de la colección
                </button>
              </div>
            </div>
          </div>
        )}

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

export default CollectionArticles
