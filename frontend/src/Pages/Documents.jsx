import { useState, useEffect } from 'react'
import { articlesAPI } from '../Api/Api'
import SearchBar from '../components/documents/SearchBar'
import DocumentControls from '../components/documents/DocumentControls'
import DocumentGrid from '../components/documents/DocumentGrid'
import DocumentList from '../components/Documents/DocumentList'
import '../styles/App.css'

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
  const [viewMode, setViewMode] = useState('grid')

  useEffect(() => {
    loadDocuments()
  }, [pagination.offset])

  useEffect(() => {
    applyFiltersAndSort()
  }, [documents, sortCriteria, filterCriteria, searchQuery])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      
      const response = await articlesAPI.getArticles({ 
        limit: pagination.limit, 
        offset: pagination.offset,
        filters: {} 
      });
      
      setDocuments(response.data.articles)
      setPagination(prev => ({
        ...prev,
        total: response.data.total
      }))
      
    } catch (err) {
      console.error('Error loading documents:', err);
      setError(err.message || 'Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...documents]

    // 1. Aplicar búsqueda primero
    if (searchQuery.trim()) {
      filtered = filtered.filter(doc =>
        (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

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
        <SearchBar onSearch={handleSearch} placeholder="Buscar por título" />
        
        <DocumentControls 
          onSort={handleSort} 
          onFilter={handleFilter}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
        
        {viewMode === 'grid' ? (
          <DocumentGrid 
            documents={filteredDocuments} 
            loading={loading} 
            error={error} 
          />
        ) : (
          <DocumentList 
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
