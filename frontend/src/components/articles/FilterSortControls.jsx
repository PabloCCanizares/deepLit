import { useState, useEffect, useRef } from 'react'
import '../../styles/articles/FilterSortControls.css'

function FilterSortControls({ 
  onSort, 
  onFilter, 
  viewMode, 
  onViewModeChange,
  currentLimit,
  onLimitChange,
  showRelevanceSort = false,
  relevanceSortEnabled = false,
  relevanceSortActive = false,
  onToggleRelevance,
}) {
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showLimitMenu, setShowLimitMenu] = useState(false)

  const sortRef = useRef(null)
  const filterRef = useRef(null)
  const limitRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortMenu(false)
      }
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
      if (limitRef.current && !limitRef.current.contains(event.target)) {
        setShowLimitMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Handlers de UI 

  const handleSort = (criteria) => {
    onSort(criteria)
    setShowSortMenu(false)
  }

  const handleFilter = (filter) => {
    onFilter(filter)
    setShowFilterMenu(false)
  }

  const handleLimitChange = (limit) => {
    onLimitChange(limit)
    setShowLimitMenu(false)
  }

  return (
    <div className="doc-controls">
      <div className="control-left">

        {/* ORDENAR */}
        <div className="control-group" ref={sortRef}>
          <button
            type="button"
            className="control-btn"
            onClick={() => setShowSortMenu(v => !v)}
          >
            <i className="fas fa-sort"></i>
            <span>Ordenar</span>
          </button>

          {showSortMenu && (
            <div className="control-dropdown">
              <button onClick={() => handleSort('year-asc')}>Año (Ascendente)</button>
              <button onClick={() => handleSort('year-desc')}>Año (Descendente)</button>
              <button onClick={() => handleSort('title-asc')}>Título (A-Z)</button>
              <button onClick={() => handleSort('title-desc')}>Título (Z-A)</button>
            </div>
          )}
        </div>

        {/* FILTRO */}
        <div className="control-group" ref={filterRef}>
          <button
            type="button"
            className="control-btn"
            onClick={() => setShowFilterMenu(v => !v)}
          >
            <i className="fas fa-filter"></i>
            <span>Filtrar por</span>
          </button>

          {showFilterMenu && (
            <div className="control-dropdown">
              <button onClick={() => handleFilter({ mode: 'all' })}>Todos</button>
              <button onClick={() => handleFilter({ mode: 'complete' })}>Completos</button>
              <button onClick={() => handleFilter({ mode: 'incomplete' })}>Incompletos</button>
            </div>
          )}
        </div>

        {showRelevanceSort && (
          <button
            type="button"
            className={`control-btn relevance-toggle ${relevanceSortActive ? 'active' : ''}`}
            onClick={() => onToggleRelevance?.()}
            disabled={!relevanceSortEnabled}
            title={
              relevanceSortEnabled
                ? 'Alternar orden por relevancia'
                : 'La relevancia solo está disponible al buscar'
            }
          >
            <i className="fas fa-crosshairs"></i>
            <span>Relevancia</span>
          </button>
        )}
      </div>

      <div className="control-right">

        {/* LÍMITE POR PÁGINA */}
        <div className="items-per-page" ref={limitRef}>
          <button
            className="paginationButton"
            onClick={() => setShowLimitMenu(v => !v)}
          >
            <span>{currentLimit}</span>
            <i className="fas fa-chevron-down"></i>
          </button>

          {showLimitMenu && (
            <div className="paginationDropdown">
              {[5, 10, 20, 50].map(limit => (
                <button
                  key={limit}
                  className={`paginationOption ${currentLimit === limit ? 'active' : ''}`}
                  onClick={() => handleLimitChange(limit)}
                >
                  {limit}
                </button>
              ))}
            </div>
          )}

          <span className="label-text">por página</span>
        </div>

        {/* CAMBIO DE VISTA */}
        <div className="view-toggle">
          <button
            type="button"
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
          >
            <i className="fas fa-list"></i>
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
          >
            <i className="fas fa-th"></i>
          </button>
        </div>

      </div>
    </div>
  )
}

export default FilterSortControls
