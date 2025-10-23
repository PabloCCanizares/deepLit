import { useState, useEffect } from 'react'
import { openalexAPI } from '../api/api'
import SearchBar from '../components/documents/SearchBar'
import DocumentControls from '../components/documents/DocumentControls'
import DocumentGrid from '../components/documents/DocumentGrid'
import DocumentList from '../components/Documents/DocumentList'
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
      const response = await openalexAPI.getWorks({ 
        limit: pagination.limit, 
        offset: pagination.offset,
        filters: {} 
      });
      console.log("OpenAlex works response:", response);
      setDocuments(response.data.articles)
      setPagination(prev => ({
        ...prev,
        total: response.data.total
      }))
      
      // Datos de prueba
      // const mockDocuments = [
      //   { _id: '1', Title: 'Systematic Literature Review on Machine Learning', Category: 'Computer Science', Pag: '350', Year: '2023' },
      //   { _id: '2', Title: 'Deep Learning Applications in Medical Imaging', Category: 'Healthcare', Pag: '450', Year: '2022' },
      //   { _id: '3', Title: 'Natural Language Processing: A Survey', Category: 'Artificial Intelligence', Pag: '520', Year: '2024' },
      //   { _id: '4', Title: 'Software Testing Automation Techniques', Category: 'Software Engineering', Pag: '380', Year: '2023' },
      //   { _id: '5', Title: 'Blockchain Technology in Supply Chain', Category: 'Information Systems', Pag: '280', Year: '2022' },
      //   { _id: '6', Title: 'Quantum Computing: Current State and Future', Category: 'Computer Science', Pag: '410', Year: '2024' },
      // ]
      // setDocuments(mockDocuments)
    } catch (err) {
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
        (doc.Title || doc.title || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // 2. Aplicar filtros
    if (filterCriteria === 'complete') {
      filtered = filtered.filter(doc => 
        doc.Title && doc.Category && doc.Pag && doc.Year
      )
    } else if (filterCriteria === 'incomplete') {
      filtered = filtered.filter(doc => 
        !doc.Title || !doc.Category || !doc.Pag || !doc.Year
      )
    }

    // 3. Aplicar ordenamiento
    filtered.sort((a, b) => {
      switch (sortCriteria) {
        case 'year-asc':
          return (parseInt(a.Year) || 0) - (parseInt(b.Year) || 0)
        case 'year-desc':
          return (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0)
        case 'title-asc':
          return (a.Title || '').localeCompare(b.Title || '')
        case 'title-desc':
          return (b.Title || '').localeCompare(a.Title || '')
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

export default OpenAlex
