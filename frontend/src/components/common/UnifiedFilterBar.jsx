import { useState, useEffect, useRef } from 'react'
import '../../styles/common/UnifiedFilterBar.css'

/* helpers */
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES   = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

function isoDate(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function parseIso(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtLabel(s) {
  if (!s) return null
  const d = parseIso(s)
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()].slice(0,3)} ${d.getFullYear()}`
}

/* --- Day range calendar picker --- */
function DayRangePicker({ dateMin, dateMax, onChangeMin, onChangeMax }) {
  const today = new Date()
  const [open, setOpen]         = useState(false)
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [pendingFrom, setPendingFrom] = useState(null)  // ISO string after first click
  const [hoverDate, setHoverDate]     = useState(null)  // ISO string while hovering
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setPendingFrom(null)
        setHoverDate(null)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Build calendar grid for current month
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Rotate so week starts on Monday (0=Mon … 6=Sun)
  const offset = (firstDay + 6) % 7
  const cells = [] // null = empty cell
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const handleDayClick = (d) => {
    const iso = isoDate(year, month, d)
    if (pendingFrom === null) {
      // First click: set from, clear to
      setPendingFrom(iso)
      onChangeMin(iso)
      onChangeMax('')
    } else {
      // Second click: finalise range (swap if needed)
      const a = parseIso(pendingFrom)
      const b = parseIso(iso)
      if (b < a) {
        onChangeMin(iso)
        onChangeMax(pendingFrom)
      } else {
        onChangeMin(pendingFrom)
        onChangeMax(iso)
      }
      setPendingFrom(null)
      setHoverDate(null)
      setOpen(false)
    }
  }

  // Determine range for styling
  const fromIso = pendingFrom ?? dateMin
  const toIso   = pendingFrom !== null ? (hoverDate ?? pendingFrom) : dateMax
  const fromD   = parseIso(fromIso)
  const toD     = parseIso(toIso)
  const rangeMin = fromD && toD ? (fromD <= toD ? fromD : toD) : fromD
  const rangeMax = fromD && toD ? (fromD <= toD ? toD : fromD) : toD

  const getCellClass = (d) => {
    if (!d) return ''
    const iso = isoDate(year, month, d)
    const dt  = parseIso(iso)
    const cls = []
    if (rangeMin && dt.getTime() === rangeMin.getTime()) cls.push('range-start')
    if (rangeMax && dt.getTime() === rangeMax.getTime()) cls.push('range-end')
    if (rangeMin && rangeMax && dt > rangeMin && dt < rangeMax) cls.push('in-range')
    return cls.join(' ')
  }

  const label = (() => {
    if (dateMin && dateMax) return `${fmtLabel(dateMin)} — ${fmtLabel(dateMax)}`
    if (dateMin) return `Desde ${fmtLabel(dateMin)}`
    if (dateMax) return `Hasta ${fmtLabel(dateMax)}`
    return 'Todas las fechas'
  })()

  return (
    <div className="ufb-daypicker" ref={ref}>
      <button
        type="button"
        className={`ufb-field-input ufb-daypicker-trigger ${dateMin || dateMax ? 'has-value' : ''}`}
        onClick={() => { setOpen(v => !v); setPendingFrom(null); setHoverDate(null) }}
      >
        <i className="fas fa-calendar-alt"></i>
        <span>{label}</span>
        <i className="fas fa-chevron-down ufb-daypicker-chevron"></i>
      </button>

      {open && (
        <div className="ufb-daypicker-dropdown">
          {/* Month navigation */}
          <div className="ufb-daypicker-header">
            <button type="button" onClick={prevMonth}><i className="fas fa-chevron-left"></i></button>
            <span>{MONTHS_ES[month]} {year}</span>
            <button type="button" onClick={nextMonth}><i className="fas fa-chevron-right"></i></button>
          </div>

          <p className="ufb-daypicker-hint">
            {pendingFrom !== null ? 'Selecciona la fecha final' : 'Selecciona la fecha inicial'}
          </p>

          {/* Day-of-week headers */}
          <div className="ufb-daypicker-grid">
            {DAYS_ES.map(d => (
              <div key={d} className="ufb-day-header">{d}</div>
            ))}
            {cells.map((d, i) => (
              d === null
                ? <div key={`e${i}`} className="ufb-day-cell empty" />
                : <button
                    key={d}
                    type="button"
                    className={`ufb-day-cell ${getCellClass(d)}`}
                    onClick={() => handleDayClick(d)}
                    onMouseEnter={() => pendingFrom !== null && setHoverDate(isoDate(year, month, d))}
                    onMouseLeave={() => pendingFrom !== null && setHoverDate(null)}
                  >
                    {d}
                  </button>
            ))}
          </div>

          {(dateMin || dateMax) && (
            <button
              type="button"
              className="ufb-daypicker-clear"
              onMouseDown={(e) => {
                e.preventDefault()
                onChangeMin(''); onChangeMax('')
                setPendingFrom(null); setOpen(false)
              }}
            >
              Limpiar fechas
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* --- Small combo-box sub-component --- */
function ComboBox({ value, onChange, suggestions = [] }) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(value)
  const ref = useRef(null)

  useEffect(() => { setLocal(value) }, [value])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes((local || '').toLowerCase())
  )

  return (
    <div className="ufb-combobox" ref={ref}>
      <input
        type="text"
        className="ufb-field-input"
        value={local}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setLocal(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
      />
      {open && filtered.length > 0 && (
        <div className="ufb-combobox-dropdown">
          {filtered.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => { setLocal(s); onChange(s); setOpen(false) }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UnifiedFilterBar({
  // From useArticleFilters hook
  searchQuery,
  fieldFilters,
  viewMode,
  activeFilterCount,
  pagination,

  handleSearch,
  handleFieldFilter,
  handleViewModeChange,
  resetFilters,
  setLimit,

  // Suggestions for autocomplete
  suggestions = {},

  // Optional features
  showRelevanceSort = false,
  relevanceSortActive = false,
  onToggleRelevance,
  handleSort,
  sortCriteria,
  searchPlaceholder = 'Buscar por título, autor...',
}) {
  const [showLimitMenu, setShowLimitMenu] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Debounced search
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const searchTimeout = useRef(null)

  const limitRef = useRef(null)

  // Sync local search with external changes
  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (limitRef.current && !limitRef.current.contains(event.target)) setShowLimitMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup search timeout
  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [])

  const onSearchInput = (e) => {
    const value = e.target.value
    setLocalSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      handleSearch(value.trim())
    }, 1000)
  }

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
      handleSearch(localSearch.trim())
    }
  }

  const doLimitChange = (limit) => {
    setLimit(limit)
    setShowLimitMenu(false)
  }

  // Active filter chips
  const getActiveChips = () => {
    const chips = []
    const minY = fieldFilters.yearMin || null
    const maxY = fieldFilters.yearMax || null
    if (minY || maxY) {
      const label = minY && maxY ? `${fmtLabel(minY)} — ${fmtLabel(maxY)}` : minY ? `Desde ${fmtLabel(minY)}` : `Hasta ${fmtLabel(maxY)}`
      chips.push({ label, onRemove: () => { handleFieldFilter('yearMin', ''); handleFieldFilter('yearMax', '') } })
    }
    if (fieldFilters.category) chips.push({ label: `Categoría: ${fieldFilters.category}`, onRemove: () => handleFieldFilter('category', '') })
    if (fieldFilters.type) chips.push({ label: `Tipo: ${fieldFilters.type}`, onRemove: () => handleFieldFilter('type', '') })
    if (fieldFilters.author) chips.push({ label: `Autor: ${fieldFilters.author}`, onRemove: () => handleFieldFilter('author', '') })
    if (fieldFilters.keyword) chips.push({ label: `Palabra clave: ${fieldFilters.keyword}`, onRemove: () => handleFieldFilter('keyword', '') })
    return chips
  }

  const activeChips = getActiveChips()

  return (
    <div className="unified-filter-bar">

      {/* Row 1: Search */}
      <div className="ufb-search-row">
        <div className="ufb-search-wrapper">
          <i className="fas fa-search ufb-search-icon"></i>
          <input
            type="text"
            value={localSearch}
            onChange={onSearchInput}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder}
            className="ufb-search-input"
          />
          {localSearch && (
            <button
              className="ufb-search-clear"
              onClick={() => { setLocalSearch(''); handleSearch('') }}
              title="Limpiar búsqueda"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Controls */}
      <div className="ufb-controls-row">
        <div className="ufb-controls-left">

          {/* Relevance Toggle */}
          {showRelevanceSort && (
            <button
              type="button"
              className={`ufb-control-btn ufb-relevance ${relevanceSortActive ? 'active' : ''}`}
              onClick={() => onToggleRelevance?.()}
              disabled={!searchQuery.trim()}
              title={searchQuery.trim() ? 'Alternar orden por relevancia' : 'Busca algo primero'}
            >
              <i className="fas fa-crosshairs"></i>
              <span>Relevancia</span>
            </button>
          )}

          {/* Advanced Filters Toggle */}
          <button
            type="button"
            className={`ufb-control-btn ufb-advanced-toggle ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(v => !v)}
          >
            <i className="fas fa-sliders-h"></i>
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="ufb-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>

        <div className="ufb-controls-right">
          {/* Items per page */}
          <div className="ufb-limit-group" ref={limitRef}>
            <button
              className="ufb-limit-btn"
              onClick={() => setShowLimitMenu(v => !v)}
            >
              <span>{pagination.limit}</span>
              <i className="fas fa-chevron-down"></i>
            </button>
            {showLimitMenu && (
              <div className="ufb-limit-dropdown">
                {[5, 10, 20, 50].map(limit => (
                  <button
                    key={limit}
                    className={pagination.limit === limit ? 'active' : ''}
                    onClick={() => doLimitChange(limit)}
                  >
                    {limit}
                  </button>
                ))}
              </div>
            )}
            <span className="ufb-limit-label">por página</span>
          </div>

          {/* View Toggle */}
          <div className="ufb-view-toggle">
            <button
              type="button"
              className={`ufb-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('list')}
              title="Vista lista"
            >
              <i className="fas fa-list"></i>
            </button>
            <button
              type="button"
              className={`ufb-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('grid')}
              title="Vista cuadrícula"
            >
              <i className="fas fa-th"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Advanced Filters (expandable) */}
      {showAdvanced && (
        <div className="ufb-advanced-row">
          <div className="ufb-advanced-grid">
            <div className="ufb-field-group">
              <label className="ufb-field-label">
                <i className="fas fa-calendar-alt"></i> Período
              </label>
              <DayRangePicker
                dateMin={fieldFilters.yearMin}
                dateMax={fieldFilters.yearMax}
                onChangeMin={(v) => handleFieldFilter('yearMin', v)}
                onChangeMax={(v) => handleFieldFilter('yearMax', v)}
              />
            </div>

            <div className="ufb-field-group">
              <label className="ufb-field-label">
                <i className="fas fa-tag"></i> Categoría
              </label>
              <ComboBox
                value={fieldFilters.category}
                onChange={(v) => handleFieldFilter('category', v)}
                suggestions={suggestions.categories || []}
              />
            </div>

            <div className="ufb-field-group">
              <label className="ufb-field-label">
                <i className="fas fa-file-alt"></i> Tipo
              </label>
              <ComboBox
                value={fieldFilters.type}
                onChange={(v) => handleFieldFilter('type', v)}
                suggestions={suggestions.types || []}
              />
            </div>

            <div className="ufb-field-group">
              <label className="ufb-field-label">
                <i className="fas fa-user"></i> Autor
              </label>
              <ComboBox
                value={fieldFilters.author}
                onChange={(v) => handleFieldFilter('author', v)}
                suggestions={suggestions.authors || []}
              />            </div>

            <div className="ufb-field-group">
              <label className="ufb-field-label">
                <i className="fas fa-key"></i> Palabra clave
              </label>
              <ComboBox
                value={fieldFilters.keyword}
                onChange={(v) => handleFieldFilter('keyword', v)}
                suggestions={suggestions.keywords || []}
              />            </div>

            <div className="ufb-field-clear">
              <button
                className="ufb-clear-btn"
                onClick={resetFilters}
                title="Limpiar todos los filtros"
              >
                <i className="fas fa-eraser"></i>
                Limpiar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 4: Active filter chips */}
      {activeChips.length > 0 && (
        <div className="ufb-chips-row">
          <span className="ufb-chips-label">Filtros activos:</span>
          {activeChips.map((chip, i) => (
            <span key={i} className="ufb-chip">
              {chip.label}
              <button className="ufb-chip-remove" onClick={chip.onRemove}>
                <i className="fas fa-times"></i>
              </button>
            </span>
          ))}
          {activeChips.length > 1 && (
            <button className="ufb-clear-all" onClick={resetFilters}>
              Limpiar todo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default UnifiedFilterBar
