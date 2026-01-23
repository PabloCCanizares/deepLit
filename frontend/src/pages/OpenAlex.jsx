import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { collectionsAPI, openalexAPI } from '../api/api'
import { useCollection } from "../context/CollectionContext";
import { usePagination } from '../hooks/usePagination';

import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import OpenAlexGrid from '../components/openalex/OpenAlexGrid'
import OpenAlexList from '../components/openalex/OpenAlexList'
// import OpenAlexControls from '../components/openalex/OpenAlexControls'
import FilterSortControls from '../components/articles/FilterSortControls'
import SelectionActions from '../components/articles/SelectionActions'
import Pagination from '../components/articles/Pagination'
import SaveToCollectionsModal from '../components/openalex/SaveToCollectionsModal'

import '../styles/App.css'

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
  const [sortCriteria, setSortCriteria] = useState(saved?.sortCriteria || 'year-desc')
  const [filterCriteria, setFilterCriteria] = useState(saved?.filterCriteria || { mode: 'all' })
  const [searchQuery, setSearchQuery] = useState(saved?.searchQuery || '')
  const [viewMode, setViewMode] = useState(saved?.viewMode || 'list')

  const [pagination, setPagination] = useState(
    saved?.pagination || { limit: 10, offset: 0, total: 0 }
  )

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [articleIdsToSave, setArticleIdsToSave] = useState([])
  const [notification, setNotification] = useState('')
  
  const {
    currentPage,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    setLimit
  } = usePagination(pagination, setPagination)


  /* ----------useEffects ----------- */

  // Auto-ocultar notificación después de 3 segundos
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  
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
  

  // Limpiar selección cuando cambia la página
  useEffect(() => {
    setSelectedArticles([])
  }, [pagination.offset])


  
  /* ---------- Data --------*/

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
  useEffect(() => {
    if (total !== pagination.total) {
      setPagination(prev => ({ ...prev, total }))
    }
  }, [total])

 


  // Handlers 

  const handleSort = (criteria) => {
    setSortCriteria(criteria)
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handleFilter = (filter) => {
    setFilterCriteria(filter)
    setPagination(prev => ({ ...prev, offset: 0 }))
  }
  
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
    if (selectedArticles.length === filteredDocuments.length) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(filteredDocuments.map(doc => doc._id || doc.id))
    }
  }

  // const handleAddToMyArticles = async () => {
  //   if (selectedArticles.length === 0) return
  //   await openalexAPI.addToMyArticles(selectedArticles)
  // }

  // Guardar o eliminar de la colección actual (botón simple toggle)
  const handleSaveArticle = async (id, isCurrentlySaved = false) => {
    try {
      if (isCurrentlySaved) {
        // Eliminar de la colección
        const res = await collectionsAPI.removeArticle(selectedCollectionId, id);
        if (res !== null) {
          setNotification('Artículo eliminado de la colección')
          // Invalidar después de un pequeño delay para que el componente actualice primero
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['savedArticles', selectedCollectionId] })
          }, 100)
        }
        return true;
      } else {
        // Guardar en la colección
        const res = await openalexAPI.saveWork(id, selectedCollectionId);
        if (res !== null) {
          setNotification('Artículo guardado en la colección')
          // Invalidar después de un pequeño delay para que el componente actualice primero
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['savedArticles', selectedCollectionId] })
          }, 100)
        }
        return true;
      }
    } catch (e) {
      console.error("Error saving/removing:", e);
      setNotification('Error: No se pudo completar la operación');
      return false;
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
    setNotification(message || 'Artículos guardados exitosamente')
    // Deseleccionar todos los artículos
    setSelectedArticles([])
    // Invalidar todas las queries de savedArticles
    queryClient.invalidateQueries({ queryKey: ['savedArticles'] })
  }

  return (
    <div className="page-container">
      <div className="container">
        <SearchBarDebounced onSearch={handleSearch} placeholder="Buscar por título" />
        
        {selectedArticles.length > 0 ? (
          <SelectionActions
            selectedCount={selectedArticles.length}
            onAddToCollections={() => handleOpenSaveModal(selectedArticles)}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        ) : (
          <FilterSortControls 
            onSort={handleSort} 
            onFilter={handleFilter}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            currentLimit={pagination.limit}
            onLimitChange={setLimit}
          />
        )}
        
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
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={prevPage}
          onNext={nextPage}
          onPageChange={setPage}
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
