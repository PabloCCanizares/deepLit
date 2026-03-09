import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collectionsAPI } from '../api/api'
import { usePagination } from '../hooks/usePagination'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import FilterSortControls from '../components/articles/FilterSortControls'
import SelectionActions from '../components/articles/SelectionActions'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import Pagination from '../components/articles/Pagination'
import '../styles/App.css'
import '../styles/articles/ArticleViewEdit.css'
import '../styles/collections/CollectionDetail.css'

function CollectionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [collection, setCollection] = useState(null)
  const [articles, setArticles] = useState([])
  const [filteredArticles, setFilteredArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [selectedArticles, setSelectedArticles] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [pendingRemoveIds, setPendingRemoveIds] = useState([])
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  const [filterCriteria, setFilterCriteria] = useState({ mode: 'all' })
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0
  })

  const {
    currentPage,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    setLimit
  } = usePagination(pagination, setPagination)

  useEffect(() => {
    loadCollection()
  }, [id])

  useEffect(() => {
    applyFiltersAndSort()
  }, [articles, sortCriteria, filterCriteria, searchQuery])

  const applyFiltersAndSort = () => {
    let filtered = [...articles]
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const mode = filterCriteria?.mode || 'all'

    // 1. Aplicar búsqueda
    if (normalizedSearch) {
      filtered = filtered.filter(article => {
        const titleText = String(article.title || '').toLowerCase()
        const authorsText = Array.isArray(article.authors)
          ? article.authors.join(', ').toLowerCase()
          : String(article.authors || '').toLowerCase()

        return (
          titleText.includes(normalizedSearch) ||
          authorsText.includes(normalizedSearch)
        )
      })
    }

    // 2. Aplicar filtros
    if (mode === 'complete') {
      filtered = filtered.filter(article => 
        article.title && article.category && article.pages && article.year
      )
    } else if (mode === 'incomplete') {
      filtered = filtered.filter(article => 
        !article.title || !article.category || !article.pages || !article.year
      )
    }

    // 3. Aplicar ordenamiento
    filtered.sort((a, b) => {
      switch (sortCriteria) {
        case 'year-asc':
          return (parseInt(a.year) || 0) - (parseInt(b.year) || 0)
        case 'year-desc':
          return (parseInt(b.year) || 0) - (parseInt(a.year) || 0)
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '')
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '')
        default:
          return 0
      }
    })

    setFilteredArticles(filtered)
    setPagination(prev => ({
      ...prev,
      total: filtered.length,
      offset: Math.min(
        prev.offset,
        filtered.length > 0 ? Math.floor((filtered.length - 1) / prev.limit) * prev.limit : 0
      )
    }))
  }

  const loadCollection = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const response = await collectionsAPI.getWithArticles(id)
      const collectionData = response.data
      
      setCollection(collectionData)
      setArticles(collectionData.articles || [])
      setPagination(prev => ({
        ...prev,
        total: (collectionData.articles || []).length
      }))
    } catch (err) {
      console.error('Error loading collection:', err)
      setCollection(null)
      setArticles([])
      setLoadError(err.message || 'Error al cargar la colección')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

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
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
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
    if (selectedArticles.length === filteredArticles.length) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(filteredArticles.map(article => article._id || article.id))
    }
  }

  const handleRemoveFromCollection = async () => {
    if (selectedArticles.length === 0) {
      showMessage('Selecciona al menos un artículo')
      return
    }

    setPendingRemoveIds(selectedArticles)
    setShowDeleteModal(true)
  }

  const handleRemoveSingleArticle = (articleId) => {
    if (!articleId) {
      return
    }

    setPendingRemoveIds([articleId])
    setShowDeleteModal(true)
  }

  const confirmRemoveFromCollection = async () => {
    const targetIds = pendingRemoveIds.length > 0 ? pendingRemoveIds : selectedArticles
    const deletedCount = targetIds.length

    if (deletedCount === 0 || removing) {
      return
    }

    try {
      setRemoving(true)
      await Promise.all(
        targetIds.map(articleId =>
          collectionsAPI.removeArticle(id, articleId)
        )
      )

      showMessage(`${deletedCount} artículo(s) eliminado(s) de la colección`)
      setSelectedArticles([])
      setPendingRemoveIds([])
      setShowDeleteModal(false)
      await loadCollection()
    } catch (err) {
      console.error('Error removing articles:', err)
      showMessage('Error al eliminar artículos de la colección')
      setShowDeleteModal(false)
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: 'var(--main_color)' }}></i>
          <p>Cargando colección...</p>
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{loadError || 'Colección no encontrada'}</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button onClick={loadCollection} className="btn-secondary">
              Reintentar
            </button>
            <button onClick={() => navigate('/collections')} className="btn-primary">
              Volver a Mis Colecciones
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="container">
        {/* Header Panel */}
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <button 
                onClick={() => navigate('/collections')} 
                className="back-button"
                title="Volver a Mis Colecciones"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              <h1 className="header-title">{collection.name}</h1>
              <span className="header-subtitle">
                {collection.description || 'Sin descripción'}
              </span>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{filteredArticles.length}</span>
                <span className="stat-label">Filtrados</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{articles.length}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje de éxito */}
        {successMessage && (
          <div className={`upload-success-notification ${successMessage.toLowerCase().includes('error') ? 'error' : ''}`}>
            <i className={`fas ${successMessage.toLowerCase().includes('error') ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Barra de búsqueda */}
        <div style={{ marginTop: '2rem' }}>
          <SearchBarDebounced 
            onSearch={handleSearch}
            placeholder="Buscar por título o autor"
          />
        </div>

        {/* Controles de artículos - Formato igual a Mis Artículos */}
        {selectedArticles.length > 0 ? (
          <SelectionActions
            selectedCount={selectedArticles.length}
            onDeleteSelected={handleRemoveFromCollection}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            isCollectionView={true}
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

        {/* Vista de artículos */}
        {loading ? (
          <div className="loading-state">
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: 'var(--main_color)' }}></i>
            <p>Cargando artículos...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-inbox"></i>
            <p>No hay artículos que coincidan con los filtros aplicados</p>
            {searchQuery && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Prueba con otros términos de búsqueda
              </p>
            )}
            {!searchQuery && articles.length === 0 && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Añade artículos desde "Mis Artículos" para verlos aquí
              </p>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <ArticleList 
            documents={filteredArticles.slice(pagination.offset, pagination.offset + pagination.limit)} 
            loading={false} 
            error={null}
            linkState={{ from: 'collection', collectionId: id }}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
            onDeleteArticle={handleRemoveSingleArticle}
          />
        ) : (
          <ArticleGrid 
            documents={filteredArticles.slice(pagination.offset, pagination.offset + pagination.limit)} 
            loading={false} 
            error={null}
            linkState={{ from: 'collection', collectionId: id }}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onDeleteArticle={handleRemoveSingleArticle}
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
                <p>¿Estás seguro de que quieres eliminar {(pendingRemoveIds.length > 0 ? pendingRemoveIds.length : selectedArticles.length)} artículo(s) de esta colección?</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Los artículos solo se eliminarán de esta colección, no de tu biblioteca.
                </p>
              </div>
              <div className="modal-footer">
                <button 
                  onClick={() => {
                    setShowDeleteModal(false)
                    setPendingRemoveIds([])
                  }} 
                  className="btn-secondary"
                  disabled={removing}
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmRemoveFromCollection} 
                  className="btn-primary"
                  disabled={removing}
                >
                  <i className={`fas ${removing ? 'fa-spinner fa-spin' : 'fa-trash'}`} style={{ marginRight: '0.5rem' }}></i>
                  {removing ? 'Eliminando...' : 'Eliminar de Colección'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CollectionDetail
