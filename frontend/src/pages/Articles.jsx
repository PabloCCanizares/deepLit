import { useState, useEffect } from 'react'
import { articlesAPI } from '../api/api'
import ArticleControls from '../components/articles/ArticleControls'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import UploadOverlay from '../components/articles/UploadOverlay'
import '../styles/App.css'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'


function Articles() {
  const [isUploadOverlayOpen, setIsUploadOverlayOpen] = useState(false)
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  const [filterCriteria, setFilterCriteria] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [pagination.offset, pagination.limit, searchQuery])

  useEffect(() => {
    applyFiltersAndSort()
  }, [documents, sortCriteria, filterCriteria])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      
      const response = await articlesAPI.getArticles({ 
        limit: pagination.limit, 
        offset: pagination.offset,
        filters: {"title": searchQuery} 
      });
      console.log("Respuesta de artículos:", response);
      
      setDocuments(response.data.articles)
      setPagination(prev => ({
        ...prev,
        total: response.data.total
      }))
      console.log("Documentos:", pagination.total);
    } catch (err) {
      setError(err.message || 'Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...documents]


    // 2. Aplicar filtros
    if (filterCriteria === 'complete') {
      filtered = filtered.filter(doc => 
        doc.title && doc.category && doc.pages && doc.year
      )
    } else if (filterCriteria === 'incomplete') {
      filtered = filtered.filter(doc => 
        !doc.title || !doc.category || !doc.pages || !doc.year
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

    setFilteredDocuments(filtered)
  }

  const handleSort = (criteria) => {
    setSortCriteria(criteria)
  }

  const handleFilter = (filter) => {
    setFilterCriteria(filter)
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
    
    // Recargar documentos después de subir (solo si no es un error)
    if (!message || !message.toLowerCase().includes('error')) {
      loadDocuments()
    }
    
    // Limpiar el mensaje después de 4 segundos
    setTimeout(() => {
      setUploadSuccessMessage('')
    }, 4000)
  }

  return (
    <div className="page-container">
      <div className="container">
              
        {/* Header Panel - Formato común */}
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Mis Documentos</h1>
              <p className="header-subtitle">
                Gestiona y organiza tu biblioteca de documentos
              </p>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{filteredDocuments.length}</span>
                <span className="stat-label">Filtrados</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{documents.length}</span>
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
        />
        
        {viewMode === 'list' ? (
          <ArticleList 
            documents={filteredDocuments} 
            loading={loading} 
            error={error} 
          />
        ) : (
          <ArticleGrid 
            documents={filteredDocuments} 
            loading={loading} 
            error={error} 
          />
        )}

        {/* Botón flotante para subir documentos */}
        <button 
          className="floating-upload-button"
          onClick={() => setIsUploadOverlayOpen(true)}
          title="Subir documentos"
        >
          <i className="fas fa-cloud-upload-alt"></i>
        </button>

        {/* Overlay de subida */}
        <UploadOverlay
          isOpen={isUploadOverlayOpen}
          onClose={() => setIsUploadOverlayOpen(false)}
          onUploadSuccess={handleUploadSuccess}
        />

        {/* Mensaje de éxito de carga */}
        {uploadSuccessMessage && (
          <div className={`upload-success-notification ${uploadSuccessMessage.toLowerCase().includes('error') ? 'error' : ''}`}>
            <span>{uploadSuccessMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Articles
