import { useState, useEffect, useRef } from 'react'
import '../../styles/openalex/OpenAlexControls.css'

function OpenAlexControls({ 
  onSort, 
  onFilter, 
  viewMode, 
  onViewModeChange,
  pagination,            // { total, limit, offset }
  onChangePagination,    // función para actualizar offset/limit
  selectedCount = 0,     // cantidad de artículos seleccionados
  totalCount = 0,        // total de artículos en la página
  onSelectAll,           // función para seleccionar todos
  onDeleteSelected,      // función para eliminar seleccionados (solo en Articles)
  onAddToMyArticles,     // función para añadir a mis artículos (solo en OpenAlex)
  onAddToCollections,    // función para añadir a colecciones (solo en Articles)
  isCollectionView = false // indica si estamos en vista de colección
}) {
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showPaginationMenu, setShowPaginationMenu] = useState(false)
  const sortRef = useRef(null)
  const filterRef = useRef(null)
  const paginationMenuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setShowSortMenu(false)
      }
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
      if (paginationMenuRef.current && !paginationMenuRef.current.contains(event.target)) {
        setShowPaginationMenu(false)
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
                <button onClick={() => handleFilter({mode:'all'})}>
                  <i className="fas fa-folder-open"></i> Todos
                </button>
                <button onClick={() => handleFilter({mode:'complete'})}>
                  <i className="fas fa-check-circle"></i> Completos
                </button>
                <button onClick={() => handleFilter({mode:'incomplete'})}>
                  <i className="fas fa-exclamation-circle"></i> Incompletos
                </button>
              </div>
            )}
          </div>
        </div>

      <div className="control-right">
        <div className="items-per-page" ref={paginationMenuRef}>
          <button 
            className="paginationButton"
            onClick={() => setShowPaginationMenu(!showPaginationMenu)}
          >
            <span>{pagination.limit}</span>
            <i className="fas fa-chevron-down"></i>
          </button>
          {showPaginationMenu && (
            <div className="paginationDropdown">
              <button
                className={`paginationOption ${pagination.limit === 5 ? 'active' : ''}`}
                onClick={() => {
                  handleLimitChange({ target: { value: '5' } })
                  setShowPaginationMenu(false)
                }}
              >
                <i className="fas fa-list"></i>
                <span>5</span>
              </button>
              <button
                className={`paginationOption ${pagination.limit === 10 ? 'active' : ''}`}
                onClick={() => {
                  handleLimitChange({ target: { value: '10' } })
                  setShowPaginationMenu(false)
                }}
              >
                <i className="fas fa-list"></i>
                <span>10</span>
              </button>
              <button
                className={`paginationOption ${pagination.limit === 20 ? 'active' : ''}`}
                onClick={() => {
                  handleLimitChange({ target: { value: '20' } })
                  setShowPaginationMenu(false)
                }}
              >
                <i className="fas fa-list"></i>
                <span>20</span>
              </button>
              <button
                className={`paginationOption ${pagination.limit === 50 ? 'active' : ''}`}
                onClick={() => {
                  handleLimitChange({ target: { value: '50' } })
                  setShowPaginationMenu(false)
                }}
              >
                <i className="fas fa-list"></i>
                <span>50</span>
              </button>
            </div>
          )}
          <span className="label-text">por página</span>
        </div>

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
          {onAddToCollections && (
            <button 
              className="btn-primary"
              onClick={onAddToCollections}
              style={{ marginRight: '0.5rem' }}
            >
              <i className="fas fa-folder-plus"></i>
              Añadir a Colección(es)
            </button>
          )}
          {onDeleteSelected && (
            <button 
              className="btn-danger"
              onClick={onDeleteSelected}
            >
              <i className="fas fa-trash"></i>
              {isCollectionView ? 'Eliminar de Colección' : 'Eliminar seleccionados'}
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

export default OpenAlexControls
