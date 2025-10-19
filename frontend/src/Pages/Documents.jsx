import { useState, useEffect } from 'react'
import SearchBar from '../components/documents/SearchBar'
import DocumentControls from '../components/documents/DocumentControls'
import DocumentGrid from '../components/documents/DocumentGrid'
import '../styles/App.css'

function Documents() {
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  const [filterCriteria, setFilterCriteria] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    applyFiltersAndSort()
  }, [documents, sortCriteria, filterCriteria, searchQuery])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      // TODO: Llamar a la API real cuando esté disponible
      // const response = await documentsAPI.getAll()
      // setDocuments(response.data)
      
      // Datos de prueba
      const mockDocuments = [
        { _id: '1', Title: 'Introducción a React', Category: 'Web Development', Pag: '350', Year: '2023' },
        { _id: '2', Title: 'Python para Ciencia de Datos', Category: 'Data Science', Pag: '450', Year: '2022' },
        { _id: '3', Title: 'Machine Learning Avanzado', Category: 'AI', Pag: '520', Year: '2024' },
        { _id: '4', Title: 'Diseño de Sistemas Distribuidos', Category: 'Architecture', Pag: '380', Year: '2023' },
        { _id: '5', Title: 'Testing en JavaScript', Category: 'Quality Assurance', Pag: '280', Year: '2022' },
        { _id: '6', Title: 'DevOps y Cloud Computing', Category: 'Infrastructure', Pag: '410', Year: '2024' },
      ]
      setDocuments(mockDocuments)
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

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'white',
      paddingTop: '2rem',
      paddingBottom: '2rem'
    }}>
      <div className="container">
        <SearchBar onSearch={handleSearch} placeholder="Buscar por título" />
        
        <DocumentControls onSort={handleSort} onFilter={handleFilter} />
        
        <DocumentGrid 
          documents={filteredDocuments} 
          loading={loading} 
          error={error} 
        />
      </div>
    </div>
  )
}

export default Documents
