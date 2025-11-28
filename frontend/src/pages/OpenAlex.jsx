import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collectionsAPI, openalexAPI } from '../api/api'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import OpenAlexControls from '../components/openalex/OpenAlexControls'
import OpenAlexGrid from '../components/openalex/OpenAlexGrid'
import OpenAlexList from '../components/openalex/OpenAlexList'
import Pagination from '../components/articles/Pagination'
import '../styles/App.css'
import { useCollection } from "../context/CollectionContext";
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'

// Variable de módulo para evitar doble lectura en StrictMode
let cachedParams = undefined

// Leer estado guardado de sessionStorage (solo si venimos de "Volver")
const getSavedParams = () => {
  // Si ya leímos, devolver lo mismo (evita problemas con StrictMode)
  if (cachedParams !== undefined) {
    return cachedParams
  }
  
  const fromDetail = sessionStorage.getItem('openalex_from_detail') === 'true'
  sessionStorage.removeItem('openalex_from_detail') // Limpiar flag
  
  if (!fromDetail) {
    sessionStorage.removeItem('openalex_params')
    cachedParams = null
    return null
  }
  
  try {
    const saved = sessionStorage.getItem('openalex_params')
    cachedParams = saved ? JSON.parse(saved) : null
    return cachedParams
  } catch {
    cachedParams = null
    return null
  }
}

// Resetear cuando el componente se desmonta (navegación real, no StrictMode)
const resetCachedParams = () => {
  cachedParams = undefined
}

function OpenAlex() {
  const { selectedCollectionId } = useCollection();
  const queryClient = useQueryClient()
  
  // Leer parámetros guardados (si existen)
  const saved = getSavedParams()
  
  // Estados para filtros y paginación (inicializados desde sessionStorage si existe)
  const [selectedArticles, setSelectedArticles] = useState([])
  const [pagination, setPagination] = useState(saved?.pagination || { limit: 10, offset: 0, total: 0 });
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [articleIdsToSave, setArticleIdsToSave] = useState([])
  const [sortCriteria, setSortCriteria] = useState(saved?.sortCriteria || 'year-desc')
  const [filterCriteria, setFilterCriteria] = useState(saved?.filterCriteria || { mode: 'all' });
  const [searchQuery, setSearchQuery] = useState(saved?.searchQuery || '')
  const [viewMode, setViewMode] = useState(saved?.viewMode || 'list')
  
  // Guardar parámetros en sessionStorage cuando cambien
  useEffect(() => {
    sessionStorage.setItem('openalex_params', JSON.stringify({
      pagination: { limit: pagination.limit, offset: pagination.offset, total: pagination.total },
      sortCriteria,
      filterCriteria,
      searchQuery,
      viewMode
    }))
    
    // Resetear cache de params para la próxima navegación
    resetCachedParams()
  }, [pagination, sortCriteria, filterCriteria, searchQuery, viewMode])

  // React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['openalex', pagination.offset, pagination.limit, searchQuery, filterCriteria, sortCriteria],
    queryFn: async () => {
      const response = await openalexAPI.getWorks({
        limit: pagination.limit,
        offset: pagination.offset,
        filters: {
          "title.search": searchQuery || undefined,
          ...filterCriteria,
        },
        sort_by: sortCriteria,
      });
      return response.data
    },
  })

  // Query separada para los IDs guardados
  const { data: savedData } = useQuery({
    queryKey: ['savedArticles', selectedCollectionId],
    queryFn: async () => {
      if (!selectedCollectionId) return { article_ids: [] }
      const response = await collectionsAPI.getIdsbyCollection(selectedCollectionId);
      return response.data
    },
    enabled: !!selectedCollectionId, // Solo ejecutar si hay colección seleccionada
  })

  // Extraer datos de las queries
  const filteredArticles = data?.articles || []
  const total = data?.total || 0
  const savedArticles = savedData?.article_ids || []

  // Actualizar total cuando cambie
  if (total !== pagination.total) {
    setPagination(prev => ({ ...prev, total }))
  }

  // Handlers (sin cambios)
  const handleSort = (criteria) => setSortCriteria(criteria)
  const handleFilter = (filter) => setFilterCriteria(filter)
  
  const handleSearch = (query) => {
    setSearchQuery(query)
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleViewModeChange = (mode) => setViewMode(mode)

  const handleSelectArticle = (articleId) => {
    setSelectedArticles(prev => 
      prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    )
  }

  const handleSelectAll = () => {
    setSelectedArticles(
      selectedArticles.length === filteredArticles.length 
        ? [] 
        : filteredArticles.map(article => article._id || article.id)
    )
  }

  const handleAddToMyArticles = async () => {
    if (selectedArticles.length === 0) return
    await openalexAPI.addToMyArticles(selectedArticles)
  }

  // Guardar en la colección actual (botón simple)
  const handleSaveArticle = async (id) => {
    try {
      const res = await openalexAPI.saveWork(id, selectedCollectionId);
      // invalidar la cache aunque la respuesta no tenga exactamente {success:true}
      if (res !== null) {
        queryClient.invalidateQueries({ queryKey: ['savedArticles', selectedCollectionId] })
      }
      return true
    } catch (e) {
      console.error("Error saving:", e);
      return false
    }
  };

  // Abrir modal para guardar en múltiples colecciones
  // acepta un id singular o un array de ids
  const handleOpenSaveModal = (idOrIds) => {
    if (!idOrIds) return
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
    setArticleIdsToSave(ids)
    setShowSaveModal(true)
  }

  // Cuando el modal termina de guardar
  const handleSaveSuccess = (message) => {
    setShowSaveModal(false)
    setArticleIdsToSave([])
    // Invalidar todas las queries de savedArticles
    queryClient.invalidateQueries({ queryKey: ['savedArticles'] })
  }

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
            loading={isLoading} 
            error={error?.message}
            baseRoute="/openalex"
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            onSelectAll={handleSelectAll}
            savedArticles={savedArticles}
            onSave={handleSaveArticle}
            onSaveMultiple={handleOpenSaveModal}
          />
        ) : (
          <OpenAlexGrid 
            documents={filteredArticles} 
            loading={isLoading} 
            error={error?.message}
            baseRoute="/openalex"
            selectedArticles={selectedArticles}
            onSelectArticle={handleSelectArticle}
            savedArticles={savedArticles}
            onSave={handleSaveArticle}
            onSaveMultiple={handleOpenSaveModal}
          />
        )}

        <Pagination 
          pagination={pagination}
          onChangePagination={setPagination}
        />

        {/* Modal para guardar en múltiples colecciones */}
        <SaveToCollectionsModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          articleIds={articleIdsToSave}
          onSuccess={handleSaveSuccess}
        />
      </div>
    </div>
  )
}

export default OpenAlex
