import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { evidenceExtractionAPI, screeningAPI } from '../api/index.js'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import { useIntervalPolling } from '../hooks/useIntervalPolling'
import NotificationToast from '../components/common/NotificationToast'
import { useCollection } from '../context/CollectionContext'

import '../styles/App.css'
import '../styles/workspace/EvidenceExtraction.css'

const SELECTION_MODE_LABELS = {
  all: 'Toda la colección',
  screening_include: 'Incluidos de screening',
  screening_include_review: 'Incluidos + revisión',
}

const SELECTION_MODE_OPTIONS = [
  {
    value: 'all',
    title: 'Toda la colección',
    description: 'Extrae fichas para todos los artículos elegibles de la colección activa.',
    icon: 'fa-layer-group',
  },
  {
    value: 'screening_include',
    title: 'Solo artículos incluidos',
    description: 'Usa un screening previo y trabaja solo con los artículos marcados como include.',
    icon: 'fa-check-double',
  },
  {
    value: 'screening_include_review',
    title: 'Incluidos + revisión',
    description: 'Amplía el scope con artículos prometedores que aún necesitan revisión manual.',
    icon: 'fa-magnifying-glass-chart',
  },
]

const SOURCE_TYPE_LABELS = {
  full_text: 'Texto completo',
  metadata: 'Metadatos',
}

function formatTimestamp(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatConfidence(confidence) {
  if (typeof confidence !== 'number') return 'N/D'
  return `${Math.round(confidence * 100)}%`
}

function formatSourceType(sourceType) {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType || 'Sin fuente'
}

function formatSelectionMode(selectionMode) {
  return SELECTION_MODE_LABELS[selectionMode] || selectionMode || 'Toda la colección'
}

function formatScreeningCounts(counts = {}) {
  return [
    `${counts.include || 0} incluidos`,
    `${counts.review || 0} revisión`,
    `${counts.exclude || 0} excluidos`,
  ].join(' · ')
}

function formatArticleFallback(articleId) {
  if (!articleId) return 'Artículo sin título'

  const withoutPrefix = String(articleId).replace(/^article_/, '')
  const withoutTimestamp = withoutPrefix.replace(/_\d{14}$/, '')
  const normalized = withoutTimestamp.replace(/[_-]+/g, ' ').trim()

  return normalized || String(articleId)
}

function isActiveRunStatus(status) {
  return ['queued', 'processing'].includes(status)
}

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function normalizeSupportEntries(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        text: String(item.text || '').trim(),
        page: typeof item.page === 'number' ? item.page : null,
      }))
      .filter((item) => item.text)
  }
  return []
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function FieldBlock({ label, children }) {
  return (
    <div className="evidence-field-block">
      <span className="evidence-field-label">{label}</span>
      <div className="evidence-field-content">{children}</div>
    </div>
  )
}

function ListBlock({ label, items, kind = 'list' }) {
  const normalizedItems = normalizeList(items)
  if (normalizedItems.length === 0) return null

  return (
    <FieldBlock label={label}>
      {kind === 'chips' ? (
        <div className="evidence-chip-list">
          {normalizedItems.map((item, index) => (
            <span key={`${label}-${index}`} className="evidence-chip">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <ul className="evidence-bullet-list">
          {normalizedItems.map((item, index) => (
            <li key={`${label}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </FieldBlock>
  )
}

function SupportBlock({ label, items }) {
  const entries = normalizeSupportEntries(items)
  if (entries.length === 0) return null

  return (
    <FieldBlock label={label}>
      <ul className="evidence-support-list">
        {entries.map((item, index) => (
          <li key={`${label}-${index}`} className="evidence-support-item">
            <span className="evidence-support-text">{item.text}</span>
            {item.page ? (
              <span className="evidence-support-meta">p. {item.page}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}

function EvidenceExtraction() {
  const navigate = useNavigate()
  const { selectedCollectionId, collections } = useCollection()

  const [runs, setRuns] = useState([])
  const [screeningRuns, setScreeningRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [results, setResults] = useState([])

  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [loadingScreenings, setLoadingScreenings] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingRun, setDeletingRun] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDeleteRunModal, setShowDeleteRunModal] = useState(false)
  const [runToDeleteId, setRunToDeleteId] = useState(null)
  const [notification, setNotification] = useState('')
  const [runsError, setRunsError] = useState(null)
  const [resultsError, setResultsError] = useState(null)
  const [screeningRunsError, setScreeningRunsError] = useState(null)
  const [formData, setFormData] = useState({
    selectionMode: 'all',
    screeningRunId: '',
  })

  const activeCollectionIdRef = useRef(selectedCollectionId)
  const loadRunsRequestIdRef = useRef(0)
  const loadResultsRequestIdRef = useRef(0)
  const loadScreeningsRequestIdRef = useRef(0)

  const selectedCollection = collections.find((collection) => collection._id === selectedCollectionId)
  const collectionName = selectedCollection?.name || null

  const activeCompletedScreenings = useMemo(
    () => screeningRuns.filter((run) => run.status === 'completed'),
    [screeningRuns]
  )

  const totalRuns = runs.length
  const processingRuns = runs.filter((run) => isActiveRunStatus(run.status)).length
  const completedRuns = runs.filter((run) => run.status === 'completed').length

  const screeningRunMap = useMemo(
    () => new Map(screeningRuns.map((run) => [run._id, run])),
    [screeningRuns]
  )

  useEffect(() => {
    activeCollectionIdRef.current = selectedCollectionId
  }, [selectedCollectionId])

  useEffect(() => {
    if (!notification) return undefined
    const timer = setTimeout(() => setNotification(''), 4000)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    setRuns([])
    setScreeningRuns([])
    setSelectedRunId(null)
    setSelectedRun(null)
    setResults([])
    setRunsError(null)
    setResultsError(null)
    setScreeningRunsError(null)
    setRunToDeleteId(null)
    setShowDeleteRunModal(false)
    setShowCreateForm(false)

    if (!selectedCollectionId) {
      return undefined
    }

    loadRuns({ collectionId: selectedCollectionId, preserveSelection: false })
    loadScreeningRuns(selectedCollectionId)
    return undefined
  }, [selectedCollectionId])

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null)
      setResults([])
      return undefined
    }

    loadRunResults(selectedRunId, selectedCollectionId)
    return undefined
  }, [selectedRunId, selectedCollectionId])

  const loadRuns = async ({ collectionId, preserveSelection = true, preferredRunId = null } = {}) => {
    if (!collectionId) return

    const requestId = loadRunsRequestIdRef.current + 1
    loadRunsRequestIdRef.current = requestId

    try {
      setLoadingRuns(true)
      setRunsError(null)
      const response = await evidenceExtractionAPI.listRuns(collectionId)
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadRunsRequestIdRef.current !== requestId
      ) {
        return
      }

      const nextRuns = response?.data?.runs || []
      setRuns(nextRuns)

      const targetRunId = preferredRunId || (preserveSelection ? selectedRunId : null)
      const hasTarget = targetRunId && nextRuns.some((run) => run._id === targetRunId)

      if (hasTarget) {
        setSelectedRunId(targetRunId)
      } else {
        setSelectedRunId(nextRuns[0]?._id || null)
      }
    } catch (error) {
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadRunsRequestIdRef.current !== requestId
      ) {
        return
      }
      setRunsError(error.message || 'Error al cargar las extracciones guardadas')
    } finally {
      if (
        activeCollectionIdRef.current === collectionId &&
        loadRunsRequestIdRef.current === requestId
      ) {
        setLoadingRuns(false)
      }
    }
  }

  const loadScreeningRuns = async (collectionId) => {
    if (!collectionId) return

    const requestId = loadScreeningsRequestIdRef.current + 1
    loadScreeningsRequestIdRef.current = requestId

    try {
      setLoadingScreenings(true)
      setScreeningRunsError(null)
      const response = await screeningAPI.listRuns(collectionId)
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadScreeningsRequestIdRef.current !== requestId
      ) {
        return
      }
      setScreeningRuns(response?.data?.runs || [])
    } catch (error) {
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadScreeningsRequestIdRef.current !== requestId
      ) {
        return
      }
      setScreeningRunsError(error.message || 'Error al cargar screenings disponibles')
    } finally {
      if (
        activeCollectionIdRef.current === collectionId &&
        loadScreeningsRequestIdRef.current === requestId
      ) {
        setLoadingScreenings(false)
      }
    }
  }

  const loadRunResults = async (runId, collectionId) => {
    if (!runId || !collectionId) return

    const requestId = loadResultsRequestIdRef.current + 1
    loadResultsRequestIdRef.current = requestId

    try {
      setLoadingResults(true)
      setResultsError(null)
      const response = await evidenceExtractionAPI.getRunResults(runId)
      if (
        loadResultsRequestIdRef.current !== requestId ||
        activeCollectionIdRef.current !== collectionId
      ) {
        return
      }
      setSelectedRun(response?.data?.run || null)
      setResults(response?.data?.results || [])
    } catch (error) {
      if (
        loadResultsRequestIdRef.current !== requestId ||
        activeCollectionIdRef.current !== collectionId
      ) {
        return
      }
      setResultsError(error.message || 'Error al cargar resultados de evidence extraction')
    } finally {
      if (
        loadResultsRequestIdRef.current === requestId &&
        activeCollectionIdRef.current === collectionId
      ) {
        setLoadingResults(false)
      }
    }
  }

  useArticlesEvents({
    onEvidenceExtractionReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Evidence extraction completada correctamente')
      await loadRuns({
        collectionId: selectedCollectionId,
        preserveSelection: true,
        preferredRunId: data.run_id,
      })
      if (data.run_id) {
        await loadRunResults(data.run_id, selectedCollectionId)
      }
    },
    onEvidenceExtractionError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(`Error en evidence extraction: ${data.error_message || 'Error desconocido'}`)
      await loadRuns({
        collectionId: selectedCollectionId,
        preserveSelection: true,
        preferredRunId: data.run_id,
      })
      if (data.run_id) {
        await loadRunResults(data.run_id, selectedCollectionId)
      }
    },
  }, Boolean(selectedCollectionId))

  useIntervalPolling(() => {
    loadRuns({
      collectionId: selectedCollectionId,
      preserveSelection: true,
      preferredRunId: selectedRunId,
    })
    if (selectedRunId) {
      loadRunResults(selectedRunId, selectedCollectionId)
    }
  }, {
    enabled: Boolean(selectedCollectionId && selectedRun && isActiveRunStatus(selectedRun.status)),
    intervalMs: 4000,
  })

  const handleCreateRun = async () => {
    if (!selectedCollectionId || submitting) return

    if (formData.selectionMode !== 'all' && !formData.screeningRunId) {
      setNotification('Debes seleccionar un screening completado para este modo')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        selection_mode: formData.selectionMode,
        screening_run_id: formData.selectionMode === 'all' ? null : formData.screeningRunId || null,
      }
      const response = await evidenceExtractionAPI.runCollection(selectedCollectionId, payload)
      const runId = response?.data?.run_id

      setShowCreateForm(false)
      setFormData({
        selectionMode: 'all',
        screeningRunId: '',
      })
      setNotification('Evidence extraction encolada correctamente')

      await loadRuns({
        collectionId: selectedCollectionId,
        preserveSelection: true,
        preferredRunId: runId,
      })
      if (runId) {
        await loadRunResults(runId, selectedCollectionId)
      }
    } catch (error) {
      setNotification(error.message || 'Error al lanzar la evidence extraction')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSelectedRun = async () => {
    if (!runToDeleteId || deletingRun) return

    const deletingSelectedRun = runToDeleteId === selectedRunId

    try {
      setDeletingRun(true)
      await evidenceExtractionAPI.deleteRun(runToDeleteId)
      setShowDeleteRunModal(false)
      setRunToDeleteId(null)

      if (deletingSelectedRun) {
        setSelectedRun(null)
        setResults([])
      }

      await loadRuns({
        collectionId: selectedCollectionId,
        preserveSelection: !deletingSelectedRun,
      })
      setNotification('Evidence extraction eliminada correctamente')
    } catch (error) {
      setNotification(error.message || 'Error al eliminar la evidence extraction')
    } finally {
      setDeletingRun(false)
    }
  }

  const handleOpenArticle = (articleId) => {
    if (!articleId) return

    navigate(`/articles/${encodeURIComponent(articleId)}`, {
      state: {
        from: 'evidence-extraction',
        collectionId: selectedCollectionId,
        runId: selectedRunId,
      },
    })
  }

  const selectedScreeningRun = selectedRun?.screening_run_id
    ? screeningRunMap.get(selectedRun.screening_run_id)
    : null

  if (!selectedCollectionId) {
    return (
      <div className="page-container collection-empty-state-page">
        <div className="collection-empty-state-card">
          <div className="collection-empty-state-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <h1>Selecciona una colección</h1>
          <p>Evidence Extraction trabaja sobre una colección concreta. Elige una en la barra superior para empezar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container evidence-page">
      <div className="container">
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Evidence Extraction</h1>
              <span className="header-subtitle">Colección activa: {collectionName}</span>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{totalRuns}</span>
                <span className="stat-label">Ejecuciones</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number pending">{processingRuns}</span>
                <span className="stat-label">Activos</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{completedRuns}</span>
                <span className="stat-label">Finalizados</span>
              </div>
            </div>
          </div>
        </div>

        <section className="evidence-toolbar">
          <div className="evidence-toolbar-copy">
            <h2>Extracción estructurada por artículo</h2>
            <p>Genera fichas reutilizables de metodología, hallazgos y limitaciones para esta colección.</p>
          </div>
          <div className="evidence-toolbar-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                loadRuns({ collectionId: selectedCollectionId, preserveSelection: true })
                loadScreeningRuns(selectedCollectionId)
              }}
              disabled={loadingRuns || loadingScreenings}
            >
              <i className="fas fa-rotate-right"></i>
              <span>{loadingRuns ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              <i className="fas fa-plus"></i>
              <span>{showCreateForm ? 'Ocultar formulario' : 'Nueva extracción'}</span>
            </button>
          </div>
        </section>

        {showCreateForm && (
          <section className="evidence-create-card">
            <div className="evidence-create-header">
              <h3>Nueva extracción de evidencia</h3>
              <p>Elige si quieres trabajar sobre toda la colección o solo sobre artículos ya seleccionados en un screening.</p>
            </div>

            <div className="evidence-form-grid">
              <div className="evidence-field evidence-field-full">
                <span>Alcance de artículos</span>
                <div className="evidence-mode-grid" role="radiogroup" aria-label="Alcance de artículos">
                  {SELECTION_MODE_OPTIONS.map((option) => {
                    const isActive = formData.selectionMode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`evidence-mode-card ${isActive ? 'active' : ''}`}
                        role="radio"
                        aria-checked={isActive}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            selectionMode: option.value,
                            screeningRunId: option.value === 'all' ? '' : prev.screeningRunId,
                          }))
                        }
                      >
                        <div className="evidence-mode-card-icon">
                          <i className={`fas ${option.icon}`}></i>
                        </div>
                        <div className="evidence-mode-card-copy">
                          <strong>{option.title}</strong>
                          <p>{option.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {formData.selectionMode !== 'all' && (
                <div className="evidence-field evidence-field-full">
                  <span>Screening base</span>
                  <div className="evidence-screening-picker" role="radiogroup" aria-label="Screening base">
                    {activeCompletedScreenings.map((run) => {
                      const isActive = formData.screeningRunId === run._id
                      return (
                        <button
                          key={run._id}
                          type="button"
                          className={`evidence-screening-option ${isActive ? 'active' : ''}`}
                          role="radio"
                          aria-checked={isActive}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              screeningRunId: run._id,
                            }))
                          }
                        >
                          <div className="evidence-screening-option-top">
                            <span className="evidence-screening-option-date">{formatTimestamp(run.created_at)}</span>
                            <span className="evidence-screening-option-summary">
                              {formatScreeningCounts(run.counts)}
                            </span>
                          </div>
                          <strong>{run.research_question}</strong>
                        </button>
                      )
                    })}
                  </div>
                  {screeningRunsError && (
                    <small className="evidence-inline-error">{screeningRunsError}</small>
                  )}
                  {!screeningRunsError && !loadingScreenings && activeCompletedScreenings.length === 0 && (
                    <small className="evidence-inline-hint">
                      No hay screenings completados disponibles para esta colección.
                    </small>
                  )}
                </div>
              )}
            </div>

            <div className="evidence-create-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowCreateForm(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateRun}
                disabled={
                  submitting ||
                  (formData.selectionMode !== 'all' && !formData.screeningRunId)
                }
              >
                <i className="fas fa-play"></i>
                <span>{submitting ? 'Encolando...' : 'Lanzar extracción'}</span>
              </button>
            </div>
          </section>
        )}

        <div className="evidence-layout">
          <aside className="evidence-runs-panel">
            <div className="evidence-panel-header">
              <div className="evidence-panel-header-main">
                <h3>Ejecuciones guardadas</h3>
                <span>{runs.length}</span>
              </div>
            </div>

            {runsError && <div className="evidence-panel-error">{runsError}</div>}

            {!runsError && runs.length === 0 && !loadingRuns && (
              <div className="evidence-panel-empty">
                <i className="fas fa-layer-group"></i>
                <p>No hay evidence extractions todavía para esta colección.</p>
              </div>
            )}

            <div className="evidence-runs-list">
              {runs.map((run) => {
                const runScreening = run.screening_run_id ? screeningRunMap.get(run.screening_run_id) : null
                const runIsActive = isActiveRunStatus(run.status)
                return (
                  <article
                    key={run._id}
                    className={`evidence-run-card ${selectedRunId === run._id ? 'active' : ''}`}
                    onClick={() => setSelectedRunId(run._id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedRunId(run._id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="evidence-run-card-top">
                      <span className={`evidence-status-badge ${run.status || 'queued'}`}>{run.status || 'queued'}</span>
                      <div className="evidence-run-card-meta">
                        <span className="evidence-run-date">{formatTimestamp(run.created_at)}</span>
                        <button
                          type="button"
                          className="evidence-run-card-delete"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (runIsActive) return
                            setRunToDeleteId(run._id)
                            setShowDeleteRunModal(true)
                          }}
                          disabled={deletingRun || runIsActive}
                          aria-label="Eliminar evidence extraction"
                          title={
                            runIsActive
                              ? 'No puedes eliminar una evidence extraction en curso'
                              : 'Eliminar evidence extraction'
                          }
                        >
                          <i className={`fas ${deletingRun && runToDeleteId === run._id ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                        </button>
                      </div>
                    </div>
                    <h4>{formatSelectionMode(run.selection_mode)}</h4>
                    {runScreening && (
                      <p className="evidence-run-screening">{runScreening.research_question}</p>
                    )}
                    <div className="evidence-run-counts">
                      <span className="processed">{run.processed_articles || 0} procesados</span>
                      <span>{run.total_articles || 0} totales</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </aside>

          <section className="evidence-detail-panel">
            {!selectedRun && !loadingResults && (
              <div className="evidence-detail-empty">
                <i className="fas fa-microscope"></i>
                <h3>Selecciona una ejecución</h3>
                <p>Aquí verás el scope del run y las fichas estructuradas extraídas por artículo.</p>
              </div>
            )}

            {selectedRun && (
              <>
                <div className="evidence-detail-header">
                  <div className="evidence-detail-copy">
                    <div className="evidence-detail-title-row">
                      <span className={`evidence-status-badge ${selectedRun.status || 'queued'}`}>
                        {selectedRun.status || 'queued'}
                      </span>
                      <span className="evidence-detail-date">{formatTimestamp(selectedRun.created_at)}</span>
                    </div>
                    <h2>{formatSelectionMode(selectedRun.selection_mode)}</h2>
                    <p>
                      {selectedScreeningRun
                        ? `Basado en screening: ${selectedScreeningRun.research_question}`
                        : 'Trabajando sobre toda la colección activa'}
                    </p>
                  </div>

                  <div className="evidence-detail-stats">
                    <div className="evidence-metric">
                      <strong>{selectedRun.processed_articles || 0}</strong>
                      <span>Procesados</span>
                    </div>
                    <div className="evidence-metric">
                      <strong>{selectedRun.total_articles || 0}</strong>
                      <span>Totales</span>
                    </div>
                  </div>
                </div>

                {selectedRun.error_message && (
                  <div className="evidence-panel-error">{selectedRun.error_message}</div>
                )}

                {resultsError && <div className="evidence-panel-error">{resultsError}</div>}

                {loadingResults && (
                  <div className="evidence-detail-empty">
                    <div className="spinner"></div>
                    <p>Cargando resultados de evidence extraction...</p>
                  </div>
                )}

                {!loadingResults && results.length === 0 && (
                  <div className="evidence-detail-empty compact">
                    <i className="fas fa-file-circle-question"></i>
                    <p>
                      {isActiveRunStatus(selectedRun.status)
                        ? 'La extracción sigue en marcha. Los resultados aparecerán aquí en cuanto termine.'
                        : 'No hay artículos extraídos para este run todavía.'}
                    </p>
                  </div>
                )}

                {!loadingResults && results.length > 0 && (
                  <div className="evidence-results-list">
                    {results.map((item) => {
                      return (
                      <article
                        key={`${item.run_id}:${item.article_id}`}
                        className="evidence-result-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenArticle(item.article_id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleOpenArticle(item.article_id)
                          }
                        }}
                      >
                        <div className="evidence-result-top">
                          <h3>{item.article_title || formatArticleFallback(item.article_id)}</h3>
                          <div className="evidence-result-meta">
                            <span className="evidence-source-pill">{formatSourceType(item.source_type)}</span>
                            <span className="evidence-confidence-pill">Confianza {formatConfidence(item.confidence)}</span>
                          </div>
                        </div>

                        <div className="evidence-result-grid">
                          {hasText(item.objective) && (
                            <FieldBlock label="Objetivo">
                              <p>{item.objective}</p>
                            </FieldBlock>
                          )}

                          {hasText(item.methodology) && (
                            <FieldBlock label="Metodología">
                              <p>{item.methodology}</p>
                            </FieldBlock>
                          )}

                          {hasText(item.dataset) && (
                            <FieldBlock label="Dataset">
                              <p>{item.dataset}</p>
                            </FieldBlock>
                          )}

                          <ListBlock label="Preguntas de investigación" items={item.research_questions} />
                          <ListBlock label="Variables" items={item.variables} kind="chips" />
                          <ListBlock label="Métricas" items={item.metrics} kind="chips" />
                          <ListBlock label="Hallazgos" items={item.findings} />
                          <ListBlock label="Limitaciones" items={item.limitations} />
                          <ListBlock label="Trabajo futuro" items={item.future_work} />
                          <SupportBlock
                            label="Soporte del objetivo"
                            items={item.objective_support}
                          />
                          <SupportBlock
                            label="Soporte metodológico"
                            items={item.methods_support}
                          />
                          <SupportBlock
                            label="Soporte de hallazgos"
                            items={item.findings_support}
                          />
                        </div>
                      </article>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <NotificationToast message={notification} onClose={() => setNotification('')} />

        {showDeleteRunModal && (
          <div
            className="modal-overlay"
            onClick={() => {
              if (!deletingRun) {
                setShowDeleteRunModal(false)
                setRunToDeleteId(null)
              }
            }}
          >
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <i className="fas fa-exclamation-triangle" style={{ color: 'var(--color-danger)' }}></i>
                  {' '}Eliminar evidence extraction
                </h2>
              </div>
              <div className="modal-body">
                <p>¿Seguro que quieres eliminar este run y todas sus fichas extraídas guardadas?</p>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => {
                    setShowDeleteRunModal(false)
                    setRunToDeleteId(null)
                  }}
                  className="btn-secondary"
                  disabled={deletingRun}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteSelectedRun}
                  className="btn-danger"
                  disabled={deletingRun}
                >
                  <i className={`fas ${deletingRun ? 'fa-spinner fa-spin' : 'fa-trash'}`} style={{ marginRight: '0.5rem' }}></i>
                  {deletingRun ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EvidenceExtraction
