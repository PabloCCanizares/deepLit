import { useState, useEffect } from 'react'
import { articlesAPI } from '../api/api'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import UploadOverlay from '../components/articles/UploadOverlay'
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'
import FilterSortControls from '../components/articles/FilterSortControls'
import SelectionActions from '../components/articles/SelectionActions'
import Pagination from '../components/articles/Pagination'
import '../styles/App.css'
import '../styles/articles/ArticleViewEdit.css'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import { useCollection } from "../context/CollectionContext";

function Articles() {
  const { selectedCollectionId } = useCollection();

  const [isUploadOverlayOpen, setIsUploadOverlayOpen] = useState(false)



  //const [loading, setLoading] = useState(false)

  // Controles de búsqueda, filtros y orden
  const [filterCriteria, setFilterCriteria] = useState({ mode: 'all' });

  // Paginación real
  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0,
  });





  //const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [selectedArticles, setSelectedArticles] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCollectionsModal, setShowCollectionsModal] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState([])
  const [modalArticleIds, setModalArticleIds] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  //const [filterCriteria, setFilterCriteria] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('')
  const [totalArticles, setTotalArticles] = useState(0) // Total sin filtros



  useEffect(() => {
    loadDocuments()
  }, [pagination.offset, pagination.limit, searchQuery, filterCriteria, sortCriteria])

  // Cargar el total de artículos sin filtros al inicio
  useEffect(() => {
    const loadTotalArticles = async () => {
      try {
        const response = await articlesAPI.getArticles({
          limit: 1,
          offset: 0,
          filters: { mode: 'all' },
        })
        setTotalArticles(response.data.total)
      } catch (err) {
        console.error('Error loading total articles:', err)
      }
    }
    loadTotalArticles()
  }, [])


  const loadDocuments = async () => {
    try {
      setLoading(true)

      console.log("Loading documents with filters:", filterCriteria, "and searchQuery:", searchQuery);

      const response = await articlesAPI.getArticles({
        limit: pagination.limit,
        offset: pagination.offset,
        filters: {
          title: searchQuery || undefined,  // ← Título dentro de filters
          ...filterCriteria,
        },

        sort_by: sortCriteria,
      });
      console.log("Respuesta de artículos:", response);

      setFilteredDocuments(response.data.articles)
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



  const handleSort = (criteria) => {
    setSortCriteria(criteria)
  }

  const handleFilter = (newFilter) => {
    setFilterCriteria(prev => ({
      ...prev,
      ...newFilter,  // sobrescribe solo los campos que vienen
    }));
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    // Reiniciar a la primera página al hacer una búsqueda
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
  }

  const handleUploadSuccess = async (message) => {
    // Cerrar el overlay inmediatamente
    setIsUploadOverlayOpen(false)

    // Mostrar mensaje de éxito
    setUploadSuccessMessage(message || 'Archivo(s) subido(s) correctamente')

    // Recargar artículos después de subir (solo si no es un error)
    if (!message || !message.toLowerCase().includes('error')) {
      setPagination(prev => ({ ...prev, offset: 0 }));
      // recargar directamente
      await loadDocuments();
      
      // Recargar el total de artículos
      try {
        const totalResponse = await articlesAPI.getArticles({
          limit: 1,
          offset: 0,
          filters: { mode: 'all' },
        })
        setTotalArticles(totalResponse.data.total)
      } catch (err) {
        console.error('Error reloading total:', err)
      }
    }

    // Limpiar el mensaje después de 4 segundos
    setTimeout(() => {
      setUploadSuccessMessage('')
    }, 4000)
  }

  const handleSelectArticle = (articleId) => {
    setSelectedArticles(prev => {
      if (prev.includes(articleId)) {
        return prev.filter(id => id !== articleId)
      } else {
        return [...prev, articleId]
      }
    })
  }

  const handleSelectAll = () => {
    if (selectedArticles.length === filteredDocuments.length) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(filteredDocuments.map(doc => doc._id || doc.id))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedArticles.length === 0) return
    setPendingDeleteIds(selectedArticles)
    setShowDeleteModal(true)
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

  const handleDeleteArticle = (articleId) => {
    setPendingDeleteIds([articleId])
    setShowDeleteModal(true)
  }

  const handleCollectionsSuccess = (message) => {
    setShowCollectionsModal(false)
    setSelectedArticles([])
    setUploadSuccessMessage(message || 'Artículos añadidos a colecciones correctamente')
    setTimeout(() => setUploadSuccessMessage(''), 4000)
  }

  const confirmDeleteSelected = async () => {
    const idsToDelete = pendingDeleteIds.length > 0 ? pendingDeleteIds : selectedArticles
    const deletedCount = idsToDelete.length

    try {
      // Eliminar los artículos
      await Promise.all(idsToDelete.map(id => articlesAPI.delete(id)))
      // limpiar selecciones que hayan sido eliminadas
      setSelectedArticles(prev => prev.filter(id => !idsToDelete.includes(id)))
      setPendingDeleteIds([])
      setShowDeleteModal(false)

      // Recargar documentos para obtener el estado actualizado
      const response = await articlesAPI.getArticles({
        limit: pagination.limit,
        offset: pagination.offset,
        filters: { "title": searchQuery }
      })

      // Si la página actual está vacía y no es la primera página, ir a la anterior
      if (response.data.articles.length === 0 && pagination.offset > 0) {
        const newOffset = Math.max(0, pagination.offset - pagination.limit)
        setPagination(prev => ({
          ...prev,
          offset: newOffset,
          total: response.data.total
        }))
      } else {
        // Actualizar con los datos nuevos
        setFilteredDocuments(response.data.articles)
        setPagination(prev => ({
          ...prev,
          total: response.data.total
        }))
      }

      setUploadSuccessMessage(`${deletedCount} artículo(s) eliminado(s) correctamente`)
      setTimeout(() => setUploadSuccessMessage(''), 4000)
    } catch (err) {
      console.error('Error deleting articles:', err)
      setUploadSuccessMessage('Error al eliminar artículos')
      setTimeout(() => setUploadSuccessMessage(''), 4000)
      setShowDeleteModal(false)
      setPendingDeleteIds([])
    }
  }

  return (
    <div className="page-container">
      <div className="container">

        {/* Header Panel - Formato común */}
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Todos Mis Artículos</h1>
              <span className="header-subtitle">
                Gestiona y organiza tu biblioteca de artículos
              </span>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{pagination.total}</span>
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
            pagination={pagination}
            onChangePagination={setPagination}
          />
        ) : (
          <FilterSortControls
            onSort={handleSort}
            onFilter={handleFilter}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            pagination={pagination}
            onChangePagination={setPagination}
          />
        )}

        {viewMode === 'list' ? (
          <ArticleList
            documents={filteredDocuments}
            loading={loading}
            error={error}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
            onAddToCollectionsSingle={handleAddSingleArticleToCollections}
            onDeleteArticle={handleDeleteArticle}
          />
        ) : (
          <ArticleGrid
            documents={filteredDocuments}
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
          pagination={pagination}
          onChangePagination={setPagination}
        />

        {/* Botón flotante para subir artículos */}
        <button
          className="floating-upload-button"
          onClick={() => setIsUploadOverlayOpen(true)}
          title="Subir artículos"
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
        {uploadSuccessMessage && (
          <div className={`upload-success-notification ${uploadSuccessMessage.toLowerCase().includes('error') ? 'error' : ''}`}>
            <i className={`fas ${uploadSuccessMessage.toLowerCase().includes('error') ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
            <span>{uploadSuccessMessage}</span>
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
