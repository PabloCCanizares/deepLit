import { useState, useEffect, useRef } from 'react'


import { articlesAPI, collectionsAPI } from '../api/api'
import { usePagination } from '../hooks/usePagination'
import { useCollection } from "../context/CollectionContext";

import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import UploadOverlay from '../components/articles/UploadOverlay'
import ProcessingQueue from '../components/articles/ProcessingQueue'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import FilterSortControls from '../components/articles/FilterSortControls'
import SelectionActions from '../components/articles/SelectionActions'
import Pagination from '../components/articles/Pagination'
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'

// import ArticleControls from '../components/articles/ArticleControls'

import '../styles/App.css'
import '../styles/articles/ArticleViewEdit.css'

function CollectionArticles() {
  const { selectedCollectionId, collections } = useCollection();

  const [documents, setDocuments] = useState([])
  const [selectedArticles, setSelectedArticles] = useState([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  const [filterCriteria, setFilterCriteria] = useState({ mode: 'all' });
  const [viewMode, setViewMode] = useState('list')

  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0,
  });

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

  const selectedCollection = collections.find(c => c._id === selectedCollectionId);
  const collectionName = selectedCollection ? selectedCollection.name : null;

  const {
    currentPage,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    setLimit
  } = usePagination(pagination, setPagination)


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
    if (!selectedCollectionId) return; // importante
    loadDocuments()
  }, [
    selectedCollectionId,
    pagination.offset,
    pagination.limit,
    searchQuery,
    sortCriteria,
    filterCriteria
  ])

  useEffect(() => {
    setSelectedArticles([])
  }, [pagination.offset])


  if (!selectedCollectionId) {
    return (
      <div className="page-container collection-empty-state-page">
        <div className="collection-empty-state-card">
          <div className="collection-empty-state-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <h1>Ninguna coleccion seleccionada</h1>
          <p>Selecciona una coleccion en el menu superior para ver sus articulos.</p>
        </div>
      </div>
    );
  }

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log("Loading documents for collection:", selectedCollectionId);
      const response = await articlesAPI.getArticles({
        collection_id: selectedCollectionId || undefined,
        limit: pagination.limit,
        offset: pagination.offset,
        filters: {
          title: searchQuery || undefined,  
          ...filterCriteria,
        },

        sort_by: sortCriteria,
      });
      console.log("Respuesta de artículos:", response);

      setDocuments(response.data.articles)
      setTotalArticles(response.data.total)
      setPagination(prev => ({
        ...prev,
        total: response.data.total
      }))
      console.log("Artículos recibidos:", response.data.articles.length, "Total del backend:", response.data.total);
    } catch (err) {
      setError(err.message || 'Error al cargar artículos')
    } finally {
      setLoading(false)
    }
  }


  // Handlers 

  const handleSort = (criteria) => {
    setSortCriteria(criteria)
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleFilter = (filter) => {
    setFilterCriteria(filter)
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    // Reiniciar a la primera página al hacer una búsqueda
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleViewModeChange = (mode) => setViewMode(mode)


  {/* SELECCIÓN DE ARTÍCULOS */}

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

  {/* SUBIR ARTÍCULOS */}

  const handleUploadSuccess = async (message) => {
    // Cerrar el overlay inmediatamente
    setIsUploadOverlayOpen(false)
    // Mostrar mensaje de éxito
    setNotification(message || 'Archivo(s) subido(s) correctamente')
    setPagination(prev => ({ ...prev, offset: 0 }))
    await loadDocuments();
  }

  {/* AÑADIR ARTÍCULOS A LAS COLECCIONES */}

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


  {/* BORRADO DE ARTÍCULOS */}

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

      setPagination(prev => ({ ...prev, offset: Math.max(0, newOffset) }))
    } catch (e) {
      setNotification('Error al quitar artículos de la colección')
    } finally {
      setShowDeleteModal(false)
      setPendingDeleteIds([])
      setSelectedArticles([])
      await loadDocuments()
    }
  }

  // const confirmRemoveFromCollection = async () => {
  //   const removedCount = selectedArticles.length

  //   try {
  //     // Eliminar los artículos de la colección (no los elimina de la base de datos)
  //     await Promise.all(
  //       selectedArticles.map(id =>
  //         collectionsAPI.removeArticle(selectedCollectionId, id)
  //       )
  //     )
  //     setSelectedArticles([])
  //     setShowRemoveModal(false)

  //     // Recargar documentos para obtener el estado actualizado
  //     const response = await articlesAPI.getArticles({
  //       collection_id: selectedCollectionId,
  //       limit: pagination.limit,
  //       offset: pagination.offset,
  //       filters: { "title": searchQuery },
  //       sort_by: sortCriteria
  //     })

  //     // Si la página actual está vacía y no es la primera página, ir a la anterior
  //     if (response.data.articles.length === 0 && pagination.offset > 0) {
  //       const newOffset = Math.max(0, pagination.offset - pagination.limit)
  //       setPagination(prev => ({
  //         ...prev,
  //         offset: newOffset,
  //         total: response.data.total
  //       }))
  //     } else {
  //       // Actualizar con los datos nuevos
  //       setFilteredDocuments(response.data.articles)
  //       setPagination(prev => ({
  //         ...prev,
  //         total: response.data.total
  //       }))
  //     }

  //     setUploadSuccessMessage(`${removedCount} artículo(s) eliminado(s) de la colección`)
  //     setTimeout(() => setUploadSuccessMessage(''), 4000)
  //   } catch (err) {
  //     console.error('Error removing articles from collection:', err)
  //     setUploadSuccessMessage('Error al eliminar artículos de la colección')
  //     setTimeout(() => setUploadSuccessMessage(''), 4000)
  //     setShowRemoveModal(false)
  //   }
  // }

  return (
    <div className="page-container">
      <div className="container">

        {/* Header Panel - Formato común */}
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
          <SearchBarDebounced onSearch={handleSearch} placeholder="Buscar por título" />
        </div>

        {selectedArticles.length > 0 ? (
          <SelectionActions
            selectedCount={selectedArticles.length}
            onAddToCollections={handleAddToCollections}
            onDeleteSelected={handleDeleteSelected}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        ) : (
          <FilterSortControls
          onSort={handleSort}
          onFilter={handleFilter}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          currentLimit={pagination.limit}
          onLimitChange={setLimit}
        />
        )}

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
        >
          <i className="fas fa-cloud-upload-alt"></i>
        </button>

        {/* Overlay de subida */}
        <UploadOverlay
          isOpen={isUploadOverlayOpen}
          onClose={() => setIsUploadOverlayOpen(false)}
          onUploadSuccess={handleUploadSuccess}
          collection_id={selectedCollectionId}
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

export default CollectionArticles
