import { useState, useEffect } from 'react'
import { articlesAPI, collectionsAPI } from '../api/api'
// import SearchBar from '../components/articles/SearchBar'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import UploadOverlay from '../components/articles/UploadOverlay'
import Pagination from '../components/articles/Pagination'
import '../styles/App.css'
import '../styles/articles/ArticleViewEdit.css'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import { useCollection } from "../context/CollectionContext";



function CollectionArticles() {
  const { selectedCollectionId, collections } = useCollection();
  const [isUploadOverlayOpen, setIsUploadOverlayOpen] = useState(false)

  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [selectedArticles, setSelectedArticles] = useState([])
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  const [filterCriteria, setFilterCriteria] = useState({ mode: 'all' });
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('')

  const selectedCollection = collections.find(c => c._id === selectedCollectionId);
  const collectionName = selectedCollection ? selectedCollection.name : null;


  useEffect(() => {
    if (!selectedCollectionId) return; // importante
    loadDocuments()
  }, [selectedCollectionId, pagination.offset, pagination.limit, searchQuery, filterCriteria, sortCriteria])


  if (!selectedCollectionId) {
    return (
      <div className="page-container">
        <h1>Ninguna colección seleccionada</h1>
        <p>Selecciona una colección en el menú de la parte superior.</p>
      </div>
    );
  }


  const loadDocuments = async () => {
    try {
      setLoading(true)
      console.log("Loading documents for collection:", selectedCollectionId);
      const response = await articlesAPI.getArticles({
        collection_id: selectedCollectionId || undefined,
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
      console.log("Artículos:", pagination.total);
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

  const handleUploadSuccess = (message) => {
    // Cerrar el overlay inmediatamente
    setIsUploadOverlayOpen(false)

    // Mostrar mensaje de éxito
    setUploadSuccessMessage(message || 'Archivo(s) subido(s) correctamente')

    // Recargar artículos después de subir (solo si no es un error)
    if (!message || !message.toLowerCase().includes('error')) {
      setPagination(prev => ({ ...prev, offset: 0 }));
      // recargar directamente
      loadDocuments();

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

  const handleRemoveFromCollection = async () => {
    if (selectedArticles.length === 0) return
    setShowRemoveModal(true)
  }

  const confirmRemoveFromCollection = async () => {
    const removedCount = selectedArticles.length

    try {
      // Eliminar los artículos de la colección (no los elimina de la base de datos)
      await Promise.all(
        selectedArticles.map(id =>
          collectionsAPI.removeArticle(selectedCollectionId, id)
        )
      )
      setSelectedArticles([])
      setShowRemoveModal(false)

      // Recargar documentos para obtener el estado actualizado
      const response = await articlesAPI.getArticles({
        collection_id: selectedCollectionId,
        limit: pagination.limit,
        offset: pagination.offset,
        filters: { "title": searchQuery },
        sort_by: sortCriteria
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

      setUploadSuccessMessage(`${removedCount} artículo(s) eliminado(s) de la colección`)
      setTimeout(() => setUploadSuccessMessage(''), 4000)
    } catch (err) {
      console.error('Error removing articles from collection:', err)
      setUploadSuccessMessage('Error al eliminar artículos de la colección')
      setTimeout(() => setUploadSuccessMessage(''), 4000)
      setShowRemoveModal(false)
    }
  }

  return (
    <div className="page-container">
      <div className="container">

        {/* Header Panel - Formato común */}
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Artículos de "{collectionName}"</h1>
              <p className="header-subtitle">
                Gestiona y organiza tu biblioteca de artículos
              </p>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">
                  {filterCriteria.mode === 'all' ? pagination.total : filteredDocuments.length}
                </span>
                <span className="stat-label">Filtrados</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{pagination.total}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
          </div>
        </div>


        <div style={{ marginTop: '2rem' }}>
          <SearchBarDebounced onSearch={handleSearch} placeholder="Buscar por título" />
        </div>

        <ArticleControls
          onSort={handleSort}
          onFilter={handleFilter}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          pagination={pagination}
          onChangePagination={setPagination}
          selectedCount={selectedArticles.length}
          totalCount={filteredDocuments.length}
          onSelectAll={handleSelectAll}
          onDeleteSelected={handleRemoveFromCollection}
          isCollectionView={true}
        />

        {viewMode === 'list' ? (
          <ArticleList
            documents={filteredDocuments}
            loading={loading}
            error={error}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
          />
        ) : (
          <ArticleGrid
            documents={filteredDocuments}
            loading={loading}
            error={error}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
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

        {/* Modal de confirmación de eliminar de colección */}
        {showRemoveModal && (
          <div className="modal-overlay" onClick={() => setShowRemoveModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <i className="fas fa-folder-minus" style={{ color: 'var(--color-warning)' }}></i>
                  {' '}Eliminar de Colección
                </h2>
              </div>
              <div className="modal-body">
                <p>¿Estás seguro de que quieres eliminar {selectedArticles.length} artículo(s) de esta colección?</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Los artículos seguirán disponibles en tu biblioteca general.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => setShowRemoveModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRemoveFromCollection}
                  className="btn-primary"
                >
                  <i className="fas fa-folder-minus" style={{ marginRight: '0.5rem' }}></i>
                  Eliminar de Colección
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CollectionArticles
