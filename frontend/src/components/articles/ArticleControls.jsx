import { useState, useEffect, useRef } from 'react'
import '../../styles/articles/ArticleControls.css'

function ArticleControls({ 
  onSort, 
  onFilter, 
  viewMode, 
  onViewModeChange,
  pagination,            // 🔹 { total, limit, offset }
  onChangePagination,    // 🔹 función para actualizar offset/limit
  selectedCount = 0,     // 🔹 cantidad de artículos seleccionados
  totalCount = 0,        // 🔹 total de artículos en la página
  onSelectAll,           // 🔹 función para seleccionar todos
  onDeleteSelected,      // 🔹 función para eliminar seleccionados (solo en Articles)
  onAddToMyArticles      // 🔹 función para añadir a mis artículos (solo en OpenAlex)
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
    <>
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
              <span>Ordenar por</span>
            </button>
            {showSortMenu && (
              <div className="control-dropdown">
                <button onClick={() => handleSort('year-asc')}>
                  <i className="fas fa-calendar-alt"></i> Año (Ascendente)
                </button>
                <button onClick={() => handleSort('year-desc')}>
                  <i className="fas fa-calendar-alt"></i> Año (Descendente)
                </button>
                <button onClick={() => handleSort('title-asc')}>
                  <i className="fas fa-sort-alpha-down"></i> Título (A-Z)
                </button>
                <button onClick={() => handleSort('title-desc')}>
                  <i className="fas fa-sort-alpha-up"></i> Título (Z-A)
                </button>
              </div>
            )}
          </div>

          {/* Filtro */}
        <div className="control-group" ref={sortRef}>
          <button 
            type="button" 
            className="control-btn"
            onClick={() => setShowSortMenu(!showSortMenu)}
          >
            <i className="fas fa-sort"></i>
            <span>Ordenar por</span>
          </button>
          {showSortMenu && (
            <div className="control-dropdown">
              <button onClick={() => handleSort('year-asc')}>
                <i className="fas fa-calendar-alt"></i> Año (Ascendente)
              </button>
              <button onClick={() => handleSort('year-desc')}>
                <i className="fas fa-calendar-alt"></i> Año (Descendente)
              </button>
              <button onClick={() => handleSort('title-asc')}>
                <i className="fas fa-sort-alpha-down"></i> Título (A-Z)
              </button>
              <button onClick={() => handleSort('title-desc')}>
                <i className="fas fa-sort-alpha-up"></i> Título (Z-A)
              </button>
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
            <span>Filtrar por</span>
          </button>
          {showFilterMenu && (
            <div className="control-dropdown">
              <button onClick={() => handleFilter('all')}>
                <i className="fas fa-folder-open"></i> Todos
              </button>
              <button onClick={() => handleFilter('complete')}>
                <i className="fas fa-check-circle"></i> Completos
              </button>
              <button onClick={() => handleFilter('incomplete')}>
                <i className="fas fa-exclamation-circle"></i> Incompletos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🔹 Paginación mejorada */}
      <div className="pagination-controls">
        <div className="items-per-page">
          <label>
            <span className="label-text">Mostrar</span>
            <select value={pagination.limit} onChange={handleLimitChange} className="pagination-select">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <span className="label-text">elementos</span>
          </label>
        </div>

        <div className="page-navigation">
          <button 
            className="nav-arrow" 
            onClick={goToPrevious} 
            disabled={currentPage <= 1}
            title="Página anterior"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          
          <div className="page-info">
            <span className="page-current">{currentPage}</span>
            <span className="page-separator">/</span>
            <span className="page-total">{totalPages || 1}</span>
          </div>
          
          <button 
            className="nav-arrow" 
            onClick={goToNext} 
            disabled={currentPage >= totalPages}
            title="Página siguiente"
          >
            <i className="fas fa-chevron-right"></i>
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

    {/* Barra de selección - Solo aparece cuando hay artículos seleccionados */}
    {selectedCount > 0 && (
      <div className="selection-controls">
        <div className="selection-left">
          <span className="selection-count">
            <i className="fas fa-check-circle"></i>
            {selectedCount} artículo(s) seleccionado(s)
          </span>
        </div>
        <div className="selection-actions">
          {onDeleteSelected && (
            <button 
              className="btn-danger"
              onClick={onDeleteSelected}
            >
              <i className="fas fa-trash"></i>
              Eliminar seleccionados
            </button>
          )}
          {onAddToMyArticles && (
            <button 
              className="btn-primary"
              onClick={onAddToMyArticles}
            >
              <i className="fas fa-plus"></i>
              Añadir a Mis Artículos
            </button>
          )}
        </div>
      </div>
    )}
    </>
  )
}

export default ArticleControls
