import { useState, useEffect, useRef } from 'react'
import '../../styles/documents/documentControls.css'

function DocumentControls({ onSort, onFilter }) {
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

  return (
    <div className="doc-controls">
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
  )
}

export default DocumentControls
