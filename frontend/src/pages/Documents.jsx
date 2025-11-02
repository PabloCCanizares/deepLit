import { useState, useEffect } from 'react'
import { articlesAPI } from '../api/api'
// import SearchBar from '../components/documents/SearchBar'
import DocumentControls from '../components/documents/DocumentControls'
import DocumentGrid from '../components/documents/DocumentGrid'
import DocumentList from '../components/documents/DocumentList'
import '../styles/App.css'
import SearchBarDebounced from '../components/documents/SearchBarDebounced'


function Documents() {
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

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'white',
      paddingTop: '2rem',
      paddingBottom: '2rem'
    }}>
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

        <DocumentControls 
          onSort={handleSort} 
          onFilter={handleFilter}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          pagination={pagination}
          onChangePagination={setPagination}
        />
        
        {viewMode === 'list' ? (
          <DocumentList 
            documents={filteredDocuments} 
            loading={loading} 
            error={error} 
          />
        ) : (
          <DocumentGrid 
            documents={filteredDocuments} 
            loading={loading} 
            error={error} 
          />
        )}
      </div>
    </div>
  )
}

export default Documents
