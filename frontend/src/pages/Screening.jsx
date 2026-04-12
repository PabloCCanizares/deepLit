import { useEffect, useMemo, useRef, useState } from 'react'

import { articlesAPI, screeningAPI } from '../api/api'
import { useCollection } from '../context/CollectionContext'

import '../styles/App.css'
import '../styles/articles/ArticleViewEdit.css'
import '../styles/workspace/Screening.css'

const DECISION_LABELS = {
  all: 'Todos',
  include: 'Incluidos',
  review: 'Revisión',
  exclude: 'Excluidos',
}

const DECISION_ORDER = {
  include: 0,
  review: 1,
  exclude: 2,
}

const DECISION_DISPLAY_LABELS = {
  include: 'Incluido',
  review: 'Revisar',
  exclude: 'Excluido',
}

const SOURCE_TYPE_LABELS = {
  full_text: 'Texto completo',
  metadata: 'Metadatos',
}

function formatSourceType(sourceType) {
  return SOURCE_TYPE_LABELS[sourceType] || 'Contexto mixto'
}

function formatDecision(decision) {
  return DECISION_DISPLAY_LABELS[decision] || decision
}

function formatConfidence(confidence) {
  if (typeof confidence !== 'number') return 'N/D'
  return `${Math.round(confidence * 100)}%`
}

function formatArticleFallback(articleId) {
  if (!articleId) return 'Artículo sin título'

  const withoutPrefix = String(articleId).replace(/^article_/, '')
  const withoutTimestamp = withoutPrefix.replace(/_\d{14}$/, '')
  const normalized = withoutTimestamp.replace(/[_-]+/g, ' ').trim()

  return normalized || String(articleId)
}

function Screening() {
  const { selectedCollectionId, collections } = useCollection()

  const [runs, setRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [results, setResults] = useState([])
  const [decisionFilter, setDecisionFilter] = useState('all')

  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [runsError, setRunsError] = useState(null)
  const [resultsError, setResultsError] = useState(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState('')
  const [formData, setFormData] = useState({
    researchQuestion: '',
    inclusionCriteria: '',
    exclusionCriteria: '',
  })

  const eventSourceRef = useRef(null)

  const selectedCollection = collections.find((collection) => collection._id === selectedCollectionId)
  const collectionName = selectedCollection ? selectedCollection.name : null

  const activeCounts = selectedRun?.counts || { include: 0, review: 0, exclude: 0 }
  const totalRuns = runs.length
  const processingRuns = runs.filter((run) => ['queued', 'processing'].includes(run.status)).length
  const completedRuns = runs.filter((run) => run.status === 'completed').length

  const filteredResults = useMemo(() => {
    const baseResults = decisionFilter === 'all'
      ? results
      : results.filter((item) => item.decision === decisionFilter)

    return [...baseResults].sort((a, b) => {
      const aOrder = DECISION_ORDER[a.decision] ?? 99
      const bOrder = DECISION_ORDER[b.decision] ?? 99
      if (aOrder !== bOrder) return aOrder - bOrder
      return String(a.article_title || '').localeCompare(String(b.article_title || ''))
    })
  }, [decisionFilter, results])

  useEffect(() => {
    if (!notification) return undefined
    const timer = setTimeout(() => setNotification(''), 4000)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    if (!selectedCollectionId) {
      setRuns([])
      setSelectedRunId(null)
      setSelectedRun(null)
      setResults([])
      return undefined
    }

    loadRuns({ preserveSelection: false })
    return undefined
  }, [selectedCollectionId])

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null)
      setResults([])
      return undefined
    }

    loadRunResults(selectedRunId)
    return undefined
  }, [selectedRunId])

  useEffect(() => {
    if (!selectedCollectionId) return undefined

    const eventSource = articlesAPI.subscribeEvents({
      onScreeningReady: async (data) => {
        if (data.collection_id !== selectedCollectionId) return
        setNotification('Screening completado correctamente')
        await loadRuns({ preserveSelection: true, preferredRunId: data.run_id })
        if (data.run_id) {
          await loadRunResults(data.run_id)
        }
      },
      onScreeningError: async (data) => {
        if (data.collection_id !== selectedCollectionId) return
        setNotification(`Error en screening: ${data.error_message || 'Error desconocido'}`)
        await loadRuns({ preserveSelection: true, preferredRunId: data.run_id })
        if (data.run_id) {
          await loadRunResults(data.run_id)
        }
      },
    })

    eventSourceRef.current = eventSource

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [selectedCollectionId, selectedRunId])

  useEffect(() => {
    if (!selectedCollectionId || !selectedRun || !['queued', 'processing'].includes(selectedRun.status)) {
      return undefined
    }

    const interval = setInterval(() => {
      loadRuns({ preserveSelection: true, preferredRunId: selectedRunId })
      if (selectedRunId) {
        loadRunResults(selectedRunId)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [selectedCollectionId, selectedRun, selectedRunId])

  const parseCriteria = (rawValue) =>
    rawValue
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

  const formatDateTime = (value) => {
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

  const loadRuns = async ({ preserveSelection = true, preferredRunId = null } = {}) => {
    if (!selectedCollectionId) return

    try {
      setLoadingRuns(true)
      setRunsError(null)
      const response = await screeningAPI.listRuns(selectedCollectionId)
      const nextRuns = response?.data?.runs || []
      setRuns(nextRuns)

      const targetRunId = preferredRunId || (preserveSelection ? selectedRunId : null)
      const hasTarget = targetRunId && nextRuns.some((run) => run._id === targetRunId)

      if (hasTarget) {
        setSelectedRunId(targetRunId)
      } else if (nextRuns.length > 0) {
        setSelectedRunId(nextRuns[0]._id)
      } else {
        setSelectedRunId(null)
      }
    } catch (err) {
      setRunsError(err.message || 'Error al cargar screenings')
    } finally {
      setLoadingRuns(false)
    }
  }

  const loadRunResults = async (runId) => {
    if (!runId) return

    try {
      setLoadingResults(true)
      setResultsError(null)
      const response = await screeningAPI.getRunResults(runId)
      setSelectedRun(response?.data?.run || null)
      setResults(response?.data?.results || [])
    } catch (err) {
      setResultsError(err.message || 'Error al cargar resultados del screening')
    } finally {
      setLoadingResults(false)
    }
  }

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateRun = async () => {
    const researchQuestion = formData.researchQuestion.trim()
    if (!selectedCollectionId || !researchQuestion || submitting) return

    try {
      setSubmitting(true)
      const payload = {
        research_question: researchQuestion,
        inclusion_criteria: parseCriteria(formData.inclusionCriteria),
        exclusion_criteria: parseCriteria(formData.exclusionCriteria),
      }
      const response = await screeningAPI.runCollection(selectedCollectionId, payload)
      const runId = response?.data?.run_id

      setNotification('Screening encolado correctamente')
      setShowCreateForm(false)
      setFormData({
        researchQuestion: '',
        inclusionCriteria: '',
        exclusionCriteria: '',
      })

      await loadRuns({ preserveSelection: true, preferredRunId: runId })
      if (runId) {
        await loadRunResults(runId)
      }
    } catch (err) {
      setNotification(err.message || 'Error al lanzar el screening')
    } finally {
      setSubmitting(false)
    }
  }

  if (!selectedCollectionId) {
    return (
      <div className="page-container collection-empty-state-page">
        <div className="collection-empty-state-card">
          <div className="collection-empty-state-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <h1>Selecciona una colección</h1>
          <p>Screening trabaja sobre una colección concreta. Elige una en la barra superior para empezar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container screening-page">
      <div className="container">
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Screening</h1>
              <span className="header-subtitle">Colección activa: {collectionName}</span>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{totalRuns}</span>
                <span className="stat-label">Runs</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number pending">{processingRuns}</span>
                <span className="stat-label">Activos</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{completedRuns}</span>
                <span className="stat-label">Completados</span>
              </div>
            </div>
          </div>
        </div>

        <section className="screening-toolbar">
          <div className="screening-toolbar-copy">
            <h2>Cribado de artículos</h2>
            <p>Lanza una pregunta de investigación y guarda decisiones por artículo para esta colección.</p>
          </div>
          <div className="screening-toolbar-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => loadRuns({ preserveSelection: true })}
              disabled={loadingRuns}
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
              <span>{showCreateForm ? 'Ocultar formulario' : 'Nuevo screening'}</span>
            </button>
          </div>
        </section>

        {showCreateForm && (
          <section className="screening-create-card">
            <div className="screening-create-header">
              <h3>Nuevo screening</h3>
              <p>La pregunta define el foco del cribado. Los criterios son opcionales y se escriben una línea por criterio.</p>
            </div>

            <div className="screening-form-grid">
              <label className="screening-field screening-field-full">
                <span>Pregunta de investigación</span>
                <textarea
                  value={formData.researchQuestion}
                  onChange={(e) => handleFormChange('researchQuestion', e.target.value)}
                  placeholder="Ejemplo: Quiero estudios sobre predicción estacional de sequía en el Mediterráneo."
                  rows={4}
                />
              </label>

              <label className="screening-field">
                <span>Criterios de inclusión</span>
                <textarea
                  value={formData.inclusionCriteria}
                  onChange={(e) => handleFormChange('inclusionCriteria', e.target.value)}
                  placeholder={'Un criterio por línea\nEjemplo: Usa índices SPEI o SPI'}
                  rows={6}
                />
              </label>

              <label className="screening-field">
                <span>Criterios de exclusión</span>
                <textarea
                  value={formData.exclusionCriteria}
                  onChange={(e) => handleFormChange('exclusionCriteria', e.target.value)}
                  placeholder={'Un criterio por línea\nEjemplo: Estudios puramente urbanos'}
                  rows={6}
                />
              </label>
            </div>

            <div className="screening-create-actions">
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
                disabled={submitting || !formData.researchQuestion.trim()}
              >
                <i className="fas fa-play"></i>
                <span>{submitting ? 'Encolando...' : 'Lanzar screening'}</span>
              </button>
            </div>
          </section>
        )}

        <div className="screening-layout">
          <aside className="screening-runs-panel">
            <div className="screening-panel-header">
              <h3>Runs guardados</h3>
              <span>{runs.length}</span>
            </div>

            {runsError && <div className="screening-panel-error">{runsError}</div>}

            {!runsError && runs.length === 0 && !loadingRuns && (
              <div className="screening-panel-empty">
                <i className="fas fa-layer-group"></i>
                <p>No hay screenings todavía para esta colección.</p>
              </div>
            )}

            <div className="screening-runs-list">
              {runs.map((run) => (
                <button
                  key={run._id}
                  type="button"
                  className={`screening-run-card ${selectedRunId === run._id ? 'active' : ''}`}
                  onClick={() => setSelectedRunId(run._id)}
                >
                  <div className="screening-run-card-top">
                    <span className={`screening-status-badge ${run.status || 'queued'}`}>{run.status || 'queued'}</span>
                    <span className="screening-run-date">{formatDateTime(run.created_at)}</span>
                  </div>
                  <h4>{run.research_question}</h4>
                  <div className="screening-run-counts">
                    <span className="include">{run.counts?.include || 0} in</span>
                    <span className="review">{run.counts?.review || 0} review</span>
                    <span className="exclude">{run.counts?.exclude || 0} out</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="screening-detail-panel">
            {!selectedRun && !loadingResults && (
              <div className="screening-detail-empty">
                <i className="fas fa-magnifying-glass-chart"></i>
                <h3>Selecciona un screening</h3>
                <p>Aquí verás la pregunta, el estado del run y la lista de artículos clasificados.</p>
              </div>
            )}

            {selectedRun && (
              <>
                <div className="screening-detail-header">
                  <div className="screening-detail-copy">
                    <div className="screening-detail-title-row">
                      <span className={`screening-status-badge ${selectedRun.status || 'queued'}`}>
                        {selectedRun.status || 'queued'}
                      </span>
                      <span className="screening-detail-date">{formatDateTime(selectedRun.created_at)}</span>
                    </div>
                    <h2>{selectedRun.research_question}</h2>
                    <p>
                      {selectedRun.inclusion_criteria?.length || 0} criterios de inclusión · {' '}
                      {selectedRun.exclusion_criteria?.length || 0} criterios de exclusión
                    </p>
                  </div>

                  <div className="screening-detail-stats">
                    <div className="screening-metric include">
                      <strong>{activeCounts.include || 0}</strong>
                      <span>Include</span>
                    </div>
                    <div className="screening-metric review">
                      <strong>{activeCounts.review || 0}</strong>
                      <span>Review</span>
                    </div>
                    <div className="screening-metric exclude">
                      <strong>{activeCounts.exclude || 0}</strong>
                      <span>Exclude</span>
                    </div>
                  </div>
                </div>

                {selectedRun.error_message && (
                  <div className="screening-panel-error">{selectedRun.error_message}</div>
                )}

                <div className="screening-filter-row">
                  {Object.entries(DECISION_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`screening-filter-chip ${decisionFilter === key ? 'active' : ''}`}
                      onClick={() => setDecisionFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {resultsError && <div className="screening-panel-error">{resultsError}</div>}

                {loadingResults && (
                  <div className="screening-detail-empty">
                    <div className="spinner"></div>
                    <p>Cargando resultados del screening...</p>
                  </div>
                )}

                {!loadingResults && filteredResults.length === 0 && (
                  <div className="screening-detail-empty compact">
                    <i className="fas fa-file-circle-question"></i>
                    <p>
                      {['queued', 'processing'].includes(selectedRun.status)
                        ? 'El screening sigue en marcha. Los resultados aparecerán aquí en cuanto termine.'
                        : 'No hay artículos para este filtro todavía.'}
                    </p>
                  </div>
                )}

                {!loadingResults && filteredResults.length > 0 && (
                  <div className="screening-results-list">
                    {filteredResults.map((item) => (
                      <article key={`${item.run_id}:${item.article_id}`} className="screening-result-card">
                        <div className="screening-result-top">
                          <h3>{item.article_title || formatArticleFallback(item.article_id)}</h3>
                          <div className="screening-result-meta">
                            <span className={`screening-decision-pill ${item.decision}`}>
                              {formatDecision(item.decision)}
                            </span>
                          </div>
                        </div>
                        <div className="screening-result-body">
                          <span className="screening-result-label">Justificación</span>
                          <p className="screening-result-reason">{item.reason}</p>
                        </div>
                        <div className="screening-result-footer">
                          <span>Fuente usada: {formatSourceType(item.source_type)}</span>
                          <span>
                            Confianza: {formatConfidence(item.confidence)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {notification && (
          <div className={`upload-success-notification ${notification.toLowerCase().includes('error') ? 'error' : ''}`}>
            <i className={`fas ${notification.toLowerCase().includes('error') ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
            <span>{notification}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Screening
