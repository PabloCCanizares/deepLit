import { useState, useCallback, useMemo } from 'react'
import { usePagination } from './usePagination'

/**
 * Hook unificado para gestionar el estado de filtros, búsqueda,
 * ordenamiento, paginación y modo de vista en páginas de artículos.
 */
export function useArticleFilters(options = {}) {
  const {
    defaultSort = 'year-desc',
    defaultViewMode = 'list',
    defaultLimit = 10,
    showRelevanceSort = false,
    initialState = {},
  } = options

  // --- State ---
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery || '')
  const [sortCriteria, setSortCriteria] = useState(initialState.sortCriteria || defaultSort)
  const [viewMode, setViewMode] = useState(initialState.viewMode || defaultViewMode)

  // Filtros avanzados por campo
  const [fieldFilters, setFieldFilters] = useState({
    yearMin: '',
    yearMax: '',
    category: '',
    type: '',
    author: '',
    keyword: '',
    ...initialState.fieldFilters,
  })

  const [pagination, setPagination] = useState(
    initialState.pagination || { limit: defaultLimit, offset: 0, total: 0 }
  )

  const paginationHelpers = usePagination(pagination, setPagination)

  // --- Handlers ---

  const resetOffset = useCallback(() => {
    setPagination(prev => ({ ...prev, offset: 0 }))
  }, [])

  const handleSearch = useCallback((query) => {
    setSearchQuery(query)
    resetOffset()
  }, [resetOffset])

  const handleSort = useCallback((criteria) => {
    setSortCriteria(criteria)
    resetOffset()
  }, [resetOffset])

  const handleFieldFilter = useCallback((field, value) => {
    setFieldFilters(prev => ({ ...prev, [field]: value }))
    resetOffset()
  }, [resetOffset])

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode)
  }, [])

  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setSortCriteria(defaultSort)
    setFieldFilters({ yearMin: '', yearMax: '', category: '', type: '', author: '', keyword: '' })
    resetOffset()
  }, [defaultSort, resetOffset])

  // --- Computed ---

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (fieldFilters.yearMin) count++
    if (fieldFilters.yearMax) count++
    if (fieldFilters.category) count++
    if (fieldFilters.type) count++
    if (fieldFilters.author) count++
    if (fieldFilters.keyword) count++
    return count
  }, [fieldFilters])

  // Construir objeto de filtros para enviar al API
  const buildApiFilters = useCallback(() => {
    const filters = {}
    if (searchQuery) filters.title = searchQuery
    // yearMin/yearMax are stored as ISO date strings e.g. "2024-01-15"
    if (fieldFilters.yearMin) {
      const year = new Date(fieldFilters.yearMin).getFullYear()
      if (!isNaN(year)) filters.year_min = year
    }
    if (fieldFilters.yearMax) {
      const year = new Date(fieldFilters.yearMax).getFullYear()
      if (!isNaN(year)) filters.year_max = year
    }
    if (fieldFilters.category) filters.category = fieldFilters.category
    if (fieldFilters.type) filters.type = fieldFilters.type
    if (fieldFilters.author) filters.author = fieldFilters.author
    if (fieldFilters.keyword) filters.keyword = fieldFilters.keyword
    return filters
  }, [searchQuery, fieldFilters])

  const setTotal = useCallback((total) => {
    setPagination(prev => {
      if (prev.total === total) return prev
      return { ...prev, total }
    })
  }, [])

  return {
    // State
    searchQuery,
    sortCriteria,
    fieldFilters,
    viewMode,
    pagination,

    // Handlers
    handleSearch,
    handleSort,
    handleFieldFilter,
    handleViewModeChange,
    resetFilters,
    setTotal,
    setPagination,

    // Pagination helpers
    ...paginationHelpers,

    // Computed
    activeFilterCount,
    buildApiFilters,

    // Options pass-through
    showRelevanceSort,
  }
}
