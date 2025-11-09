import { useState, useEffect } from 'react'
import { openalexAPI } from '../api/api'
import SearchBarDebounced from '../components/documents/SearchBarDebounced'
import DocumentControls from '../components/documents/DocumentControls'
import DocumentGrid from '../components/documents/DocumentGrid'
import DocumentList from '../components/documents/DocumentList'
import '../styles/App.css'

function OpenAlex() {
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
      const response = await openalexAPI.getWorks({ 
        limit: pagination.limit, 
        offset: pagination.offset,
        filters: {"title.search": searchQuery} 
      });

      console.log("Respuesta de OpenAlex:", response);
      
      setDocuments(response.data.articles)
      setPagination(prev => ({
        ...prev,
        total: response.data.total
      }))
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
        <SearchBarDebounced onSearch={handleSearch} placeholder="Buscar por título" />
        
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
            baseRoute="/openalex"
          />
        ) : (
          <DocumentGrid 
            documents={filteredDocuments} 
            loading={loading} 
            error={error}
            baseRoute="/openalex"
          />
        )}
      </div>
    </div>
  )
}

export default OpenAlex
