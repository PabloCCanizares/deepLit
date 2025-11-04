import { useState, useEffect, useRef } from 'react'
import '../../styles/documents/DocumentControls.css'

function DocumentControls({ 
  onSort, 
  onFilter, 
  viewMode, 
  onViewModeChange,
  pagination,            // 🔹 { total, limit, offset }
  onChangePagination     // 🔹 función para actualizar offset/limit
}) {
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const sortRef = useRef(null)
  const filterRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortMenu(false)
      }
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSort = (criteria) => {
    onSort(criteria)
    setShowSortMenu(false)
  }

  const handleFilter = (filter) => {
    onFilter(filter)
    setShowFilterMenu(false)
  }

  // 🔹 Cálculo de página actual y total
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  // 🔹 Navegación
  const goToPrevious = () => {
    if (pagination.offset > 0) {
      onChangePagination({
        ...pagination,
        offset: Math.max(0, pagination.offset - pagination.limit)
      })
    }
  }

  const goToNext = () => {
    if ((pagination.offset + pagination.limit) < pagination.total) {
      onChangePagination({
        ...pagination,
        offset: pagination.offset + pagination.limit
      })
    }
  }

  // 🔹 Cambio de límite
  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value)
    onChangePagination({
      ...pagination,
      limit: newLimit,
      offset: 0 // reseteamos a la primera página
    })
  }

  return (
    <div className="doc-controls">
      <div className="control-left">
        {/* Ordenar */}
        <div className="control-group" ref={sortRef}>
          <button 
            type="button" 
            className="control-btn"
            onClick={() => setShowSortMenu(!showSortMenu)}
          >
            <i className="fas fa-sort"></i>
            Ordenar por
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

        {/* Filtro */}
        <div className="control-group" ref={filterRef}>
          <button 
            type="button" 
            className="control-btn"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
          >
            <i className="fas fa-filter"></i>
            Filtrar por
          </button>
          {showFilterMenu && (
            <div className="control-dropdown">
              <button onClick={() => handleFilter('all')}>Todos</button>
              <button onClick={() => handleFilter('complete')}>Completos</button>
              <button onClick={() => handleFilter('incomplete')}>Incompletos</button>
            </div>
          )}
        </div>
      </div>

      {/* 🔹 Paginación */}
      <div className="pagination-controls">
        <label>
          Mostrar:&nbsp;
          <select value={pagination.limit} onChange={handleLimitChange}>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
          &nbsp;por página
        </label>

        <div className="page-nav">
          <button onClick={goToPrevious} disabled={currentPage <= 1}>
            ⟵
          </button>
          <span>
            Página {currentPage} de {totalPages || 1}
          </span>
          <button onClick={goToNext} disabled={currentPage >= totalPages}>
            ⟶
          </button>
        </div>

      </div>

      <div className="control-right">
        <div className="view-toggle">

          <button
            type="button"
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="Vista lista"
          >
            <i className="fas fa-list"></i>
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Vista mosaico"
          >
            <i className="fas fa-th"></i>
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentControls
