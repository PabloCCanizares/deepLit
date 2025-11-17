import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collectionsAPI } from '../api/api'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import ArticleControls from '../components/articles/ArticleControls'
import ArticleCard from '../components/articles/ArticleCard'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [selectedArticles, setSelectedArticles] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  const [filterCriteria, setFilterCriteria] = useState('all')
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0
  })

  useEffect(() => {
    loadCollection()
  }, [id])

  useEffect(() => {
    applyFiltersAndSort()
  }, [articles, sortCriteria, filterCriteria, searchQuery])

  const applyFiltersAndSort = () => {
    let filtered = [...articles]

    // 1. Aplicar búsqueda
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(article =>
        article.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.authors?.some(author => 
          author.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    }

    // 2. Aplicar filtros
    if (filterCriteria === 'complete') {
      filtered = filtered.filter(article => 
        article.title && article.category && article.pages && article.year
      )
    } else if (filterCriteria === 'incomplete') {
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
  }

  const loadCollection = async () => {
    try {
      setLoading(true)
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
      showMessage('Error al cargar la colección')
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
  }

  const handleFilter = (filter) => {
    setFilterCriteria(filter)
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
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

    setShowDeleteModal(true)
  }

  const confirmRemoveFromCollection = async () => {
    const deletedCount = selectedArticles.length

    try {
      await Promise.all(
        selectedArticles.map(articleId =>
          collectionsAPI.removeArticle(id, articleId)
        )
      )

      showMessage(`${deletedCount} artículo(s) eliminado(s) de la colección`)
      setSelectedArticles([])
      setShowDeleteModal(false)
      await loadCollection()
    } catch (err) {
      console.error('Error removing articles:', err)
      showMessage('Error al eliminar artículos de la colección')
      setShowDeleteModal(false)
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
          <p>Colección no encontrada</p>
          <button onClick={() => navigate('/collections')} className="btn-primary">
            Volver a Mis Colecciones
          </button>
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
            <div className="header-info" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={() => navigate('/collections')} 
                    className="back-button"
                    title="Volver a Mis Colecciones"
                    style={{ position: 'relative', transform: 'none', top: 'auto', left: 'auto' }}
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <h1 className="header-title" style={{ margin: 0 }}>{collection.name}</h1>
                </div>
                <div className="header-stats" style={{ margin: 0 }}>
                  <div className="stat-item">
                    <span className="stat-number">
                      {filterCriteria === 'all' ? filteredArticles.length : filteredArticles.length}
                    </span>
                    <span className="stat-label">Filtrados</span>
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <span className="stat-number">{articles.length}</span>
                    <span className="stat-label">Total</span>
                  </div>
                </div>
              </div>
              <p className="header-subtitle" style={{ marginTop: '0.5rem', marginLeft: '58px' }}>
                {collection.description || 'Sin descripción'}
              </p>
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
        <ArticleControls 
          onSort={handleSort} 
          onFilter={handleFilter}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          pagination={pagination}
          onChangePagination={setPagination}
          selectedCount={selectedArticles.length}
          totalCount={filteredArticles.length}
          onSelectAll={handleSelectAll}
          onDeleteSelected={handleRemoveFromCollection}
          isCollectionView={true}
        />

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
            documents={filteredArticles} 
            loading={false} 
            error={null}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
          />
        ) : (
          <ArticleGrid 
            documents={filteredArticles} 
            loading={false} 
            error={null}
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
          />
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
                <p>¿Estás seguro de que quieres eliminar {selectedArticles.length} artículo(s) de esta colección?</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Los artículos solo se eliminarán de esta colección, no de tu biblioteca.
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
                  onClick={confirmRemoveFromCollection} 
                  className="btn-primary"
                >
                  <i className="fas fa-trash" style={{ marginRight: '0.5rem' }}></i>
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

export default CollectionDetail
