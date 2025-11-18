import { useState, useEffect } from 'react'
import { openalexAPI } from '../api/api'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import ArticleControls from '../components/articles/ArticleControls'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleList from '../components/articles/ArticleList'
import '../styles/App.css'

function OpenAlex() {
  const [articles, setArticles] = useState([])
  const [filteredArticles, setFilteredArticles] = useState([])
  const [selectedArticles, setSelectedArticles] = useState([])
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
    loadArticles()
  }, [pagination.offset, pagination.limit, searchQuery])

  useEffect(() => {
    applyFiltersAndSort()
  }, [articles, sortCriteria, filterCriteria])

  const loadArticles = async () => {
    try {
      setLoading(true)
      const response = await openalexAPI.getWorks({ 
        limit: pagination.limit, 
        offset: pagination.offset,
        filters: {"title.search": searchQuery} 
      });

      console.log("Respuesta de OpenAlex:", response);
      
      setArticles(response.data.articles)
      setPagination(prev => ({
        ...prev,
        total: response.data.total
      }))
    } catch (err) {
      setError(err.message || 'Error al cargar artículos')
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...articles]


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

  const handleAddToMyArticles = async () =>{
    if (selectedArticles.length === 0) return
    
    const response = await openalexAPI.addToMyArticles(selectedArticles)
  }

  return (
    <div className="page-container">
      <div className="container">
        <SearchBarDebounced onSearch={handleSearch} placeholder="Buscar por título" />
        
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
          onAddToMyArticles={handleAddToMyArticles}
        />
        
        {viewMode === 'list' ? (
          <ArticleList 
            documents={filteredArticles} 
            loading={loading} 
            error={error}
            baseRoute="/openalex"
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
          />
        ) : (
          <ArticleGrid 
            documents={filteredArticles} 
            loading={loading} 
            error={error}
            baseRoute="/openalex"
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
          />
        )}
      </div>
    </div>
  )
}

export default OpenAlex
