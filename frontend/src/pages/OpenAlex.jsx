import { useState, useEffect } from 'react'
import { collectionsAPI, openalexAPI } from '../api/api'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import OpenAlexControls from '../components/openalex/OpenAlexControls'
import OpenAlexGrid from '../components/openalex/OpenAlexGrid'
import OpenAlexList from '../components/openalex/OpenAlexList'
import Pagination from '../components/articles/Pagination'
import '../styles/App.css'
import { useCollection } from "../context/CollectionContext";

function OpenAlex() {
  const { selectedCollectionId } = useCollection();
  const [filteredArticles, setFilteredArticles] = useState([])
  const [selectedArticles, setSelectedArticles] = useState([])
  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortCriteria, setSortCriteria] = useState('year-desc')
  const [filterCriteria, setFilterCriteria] = useState({mode: 'all'});
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')

  const [savedArticles, setSavedArticles] = useState([]);


  useEffect(() => {
    loadArticles()
  }, [pagination.offset, pagination.limit, searchQuery, filterCriteria, sortCriteria])

  const loadArticles = async () => {
    try {
      setLoading(true)
      const response = await openalexAPI.getWorks({
        limit: pagination.limit,
        offset: pagination.offset,

        filters: {
          "title.search": searchQuery || undefined,  // Título dentro de filters
          ...filterCriteria,
        },

        sort_by: sortCriteria,
      });

      if (selectedCollectionId) {
      //Traer los IDS de los artículos guardados en la colección actuals
        const savedIds = await collectionsAPI.getIdsbyCollection(selectedCollectionId);
        setSavedArticles(savedIds.data.article_ids || []);
      }

      console.log("Respuesta de OpenAlex:", response);
      
      setFilteredArticles(response.data.articles)
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


  const handleSaveArticle = async (id) => {
    try {
      console.log("GGGGGGGGGGGardando artículo con ID:", id);
      const res = await openalexAPI.saveWork(id, selectedCollectionId);
      console.log("Respuesta al guardar artículo:", res);
      if (res.success) {
        // Añadir el ID a la lista de guardados
        console.log("Artículo guardado con éxito:", savedArticles);
        setSavedArticles(prev => [...prev, id]);
        console.log("Lista actualizada de artículos guardados:", savedArticles);
      }
    } catch (e) {
      console.error("Error saving:", e);
    }
  };


  return (
    <div className="page-container">
      <div className="container">
        <SearchBarDebounced onSearch={handleSearch} placeholder="Buscar por título" />
        
        <OpenAlexControls 
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
          <OpenAlexList 
            documents={filteredArticles} 
            loading={loading} 
            error={error}
            baseRoute="/openalex"
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
            savedArticles={savedArticles}
            onSave={handleSaveArticle}
          />
        ) : (
          <OpenAlexGrid 
            documents={filteredArticles} 
            loading={loading} 
            error={error}
            baseRoute="/openalex"
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
          />
        )}

        {/* Paginación debajo de los artículos */}
        <Pagination 
          pagination={pagination}
          onChangePagination={setPagination}
        />
      </div>
    </div>
  )
}

export default OpenAlex
