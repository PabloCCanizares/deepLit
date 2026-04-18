import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { clusteringAPI, evidenceExtractionAPI } from '../api/index.js'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import { useIntervalPolling } from '../hooks/useIntervalPolling'
import NotificationToast from '../components/common/NotificationToast'
import { useCollection } from '../context/CollectionContext'

import '../styles/App.css'
import '../styles/workspace/Clustering.css'

const EVIDENCE_MODE_LABELS = {
  all: 'Toda la colección',
  screening_include: 'Incluidos de screening',
  screening_include_review: 'Incluidos + revisión',
}

const CLUSTER_MODE_OPTIONS = [
  {
    value: 'auto',
    title: 'Selección automática',
    description: 'El sistema prueba varios agrupamientos y elige el más coherente para el run.',
    icon: 'fa-wand-magic-sparkles',
  },
  {
    value: 'manual',
    title: 'Número fijo de clusters',
    description: 'Define tú mismo cuántos grupos quieres intentar construir.',
    icon: 'fa-sliders',
  },
]

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

function formatEvidenceMode(value) {
  return EVIDENCE_MODE_LABELS[value] || value || 'Toda la colección'
}

function formatSilhouette(value) {
  if (typeof value !== 'number') return 'N/D'
  return value.toFixed(2)
}

function formatSimilarity(value) {
  if (typeof value !== 'number') return 'N/D'
  return `${Math.round(Math.max(0, value) * 100)}%`
}

function formatArticleFallback(articleId) {
  if (!articleId) return 'Artículo sin título'

  const withoutPrefix = String(articleId).replace(/^article_/, '')
  const withoutTimestamp = withoutPrefix.replace(/_\d{14}$/, '')
  const normalized = withoutTimestamp.replace(/[_-]+/g, ' ').trim()
  return normalized || String(articleId)
}

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function trimText(value, maxLength = 220) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength).split(' ').slice(0, -1).join(' ').trim()
  return `${truncated || text.slice(0, maxLength)}...`
}

function isActiveRunStatus(status) {
  return ['queued', 'processing'].includes(status)
}

function FieldPillList({ items }) {
  const normalizedItems = normalizeList(items)
  if (normalizedItems.length === 0) return null

  return (
    <div className="clustering-chip-list">
      {normalizedItems.map((item, index) => (
        <span key={`${item}-${index}`} className="clustering-chip">
          {item}
        </span>
      ))}
    </div>
  )
}

function Clustering() {
  const navigate = useNavigate()
  const { selectedCollectionId, collections } = useCollection()

  const [runs, setRuns] = useState([])
  const [evidenceRuns, setEvidenceRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [results, setResults] = useState([])

  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [loadingEvidenceRuns, setLoadingEvidenceRuns] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingRun, setDeletingRun] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showDeleteRunModal, setShowDeleteRunModal] = useState(false)
  const [runToDeleteId, setRunToDeleteId] = useState(null)
  const [notification, setNotification] = useState('')
  const [runsError, setRunsError] = useState(null)
  const [resultsError, setResultsError] = useState(null)
  const [evidenceRunsError, setEvidenceRunsError] = useState(null)
  const [formData, setFormData] = useState({
    evidenceRunId: '',
    clusterMode: 'auto',
    clusterCount: 3,
  })

  const activeCollectionIdRef = useRef(selectedCollectionId)
  const loadRunsRequestIdRef = useRef(0)
  const loadResultsRequestIdRef = useRef(0)
  const loadEvidenceRunsRequestIdRef = useRef(0)

  const selectedCollection = collections.find((collection) => collection._id === selectedCollectionId)
  const collectionName = selectedCollection?.name || null
  const evidenceRunMap = useMemo(
    () => new Map(evidenceRuns.map((run) => [run._id, run])),
    [evidenceRuns]
  )
  const activeCompletedEvidenceRuns = useMemo(
    () => evidenceRuns.filter((run) => run.status === 'completed'),
    [evidenceRuns]
  )
  const selectedEvidenceRun = selectedRun?.evidence_extraction_run_id
    ? evidenceRunMap.get(selectedRun.evidence_extraction_run_id)
    : null

  const groupedClusters = useMemo(() => {
    if (!selectedRun?.clusters) return []

    const assignmentsByCluster = new Map()
    for (const item of results) {
      const current = assignmentsByCluster.get(item.cluster_id) || []
      current.push(item)
      assignmentsByCluster.set(item.cluster_id, current)
    }

    return (selectedRun.clusters || []).map((cluster) => ({
      ...cluster,
      items: assignmentsByCluster.get(cluster.cluster_id) || [],
    }))
  }, [results, selectedRun])

  const totalRuns = runs.length
  const processingRuns = runs.filter((run) => isActiveRunStatus(run.status)).length
  const completedRuns = runs.filter((run) => run.status === 'completed').length

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
    setEvidenceRuns([])
    setSelectedRunId(null)
    setSelectedRun(null)
    setResults([])
    setRunsError(null)
    setResultsError(null)
    setEvidenceRunsError(null)
    setRunToDeleteId(null)
    setShowDeleteRunModal(false)
    setShowCreateForm(false)

    if (!selectedCollectionId) {
      return undefined
    }

    loadRuns({ collectionId: selectedCollectionId, preserveSelection: false })
    loadEvidenceRuns(selectedCollectionId)
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
      const response = await clusteringAPI.listRuns(collectionId)
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
      setRunsError(error.message || 'Error al cargar los clusterings guardados')
    } finally {
      if (
        activeCollectionIdRef.current === collectionId &&
        loadRunsRequestIdRef.current === requestId
      ) {
        setLoadingRuns(false)
      }
    }
  }

  const loadEvidenceRuns = async (collectionId) => {
    if (!collectionId) return

    const requestId = loadEvidenceRunsRequestIdRef.current + 1
    loadEvidenceRunsRequestIdRef.current = requestId

    try {
      setLoadingEvidenceRuns(true)
      setEvidenceRunsError(null)
      const response = await evidenceExtractionAPI.listRuns(collectionId)
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadEvidenceRunsRequestIdRef.current !== requestId
      ) {
        return
      }
      setEvidenceRuns(response?.data?.runs || [])
    } catch (error) {
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadEvidenceRunsRequestIdRef.current !== requestId
      ) {
        return
      }
      setEvidenceRunsError(error.message || 'Error al cargar evidence extractions disponibles')
    } finally {
      if (
        activeCollectionIdRef.current === collectionId &&
        loadEvidenceRunsRequestIdRef.current === requestId
      ) {
        setLoadingEvidenceRuns(false)
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
      const response = await clusteringAPI.getRunResults(runId)
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
      setResultsError(error.message || 'Error al cargar resultados de clustering')
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
    onClusteringReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Clustering completado correctamente')
      await loadRuns({
        collectionId: selectedCollectionId,
        preserveSelection: true,
        preferredRunId: data.run_id,
      })
      if (data.run_id) {
        await loadRunResults(data.run_id, selectedCollectionId)
      }
    },
    onClusteringError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(`Error en clustering: ${data.error_message || 'Error desconocido'}`)
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
    if (!selectedCollectionId || submitting || !formData.evidenceRunId) return

    try {
      setSubmitting(true)
      const payload = {
        evidence_extraction_run_id: formData.evidenceRunId,
        cluster_count:
          formData.clusterMode === 'manual'
            ? Number(formData.clusterCount) || null
            : null,
      }

      const response = await clusteringAPI.runCollection(selectedCollectionId, payload)
      const runId = response?.data?.run_id

      setShowCreateForm(false)
      setFormData({
        evidenceRunId: '',
        clusterMode: 'auto',
        clusterCount: 3,
      })
      setNotification('Clustering encolado correctamente')

      await loadRuns({
        collectionId: selectedCollectionId,
        preserveSelection: true,
        preferredRunId: runId,
      })
      if (runId) {
        await loadRunResults(runId, selectedCollectionId)
      }
    } catch (error) {
      setNotification(error.message || 'Error al lanzar el clustering')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSelectedRun = async () => {
    if (!runToDeleteId || deletingRun) return

    const deletingSelectedRun = runToDeleteId === selectedRunId

    try {
      setDeletingRun(true)
      await clusteringAPI.deleteRun(runToDeleteId)
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
      setNotification('Clustering eliminado correctamente')
    } catch (error) {
      setNotification(error.message || 'Error al eliminar el clustering')
    } finally {
      setDeletingRun(false)
    }
  }

  const handleOpenArticle = (articleId) => {
    if (!articleId) return

    navigate(`/articles/${encodeURIComponent(articleId)}`, {
      state: {
        from: 'clustering',
        collectionId: selectedCollectionId,
        runId: selectedRunId,
      },
    })
  }

  if (!selectedCollectionId) {
    return (
      <div className="page-container collection-empty-state-page">
        <div className="collection-empty-state-card">
          <div className="collection-empty-state-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <h1>Selecciona una colección</h1>
          <p>Clustering trabaja sobre una colección concreta. Elige una en la barra superior para empezar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container clustering-page">
      <div className="container">
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Clustering</h1>
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

        <section className="clustering-toolbar">
          <div className="clustering-toolbar-copy">
            <h2>Agrupación temática sobre evidencia estructurada</h2>
            <p>Construye grupos de artículos similares a partir de un evidence extraction run ya completado.</p>
          </div>
          <div className="clustering-toolbar-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                loadRuns({ collectionId: selectedCollectionId, preserveSelection: true })
                loadEvidenceRuns(selectedCollectionId)
              }}
              disabled={loadingRuns || loadingEvidenceRuns}
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
              <span>{showCreateForm ? 'Ocultar formulario' : 'Nuevo clustering'}</span>
            </button>
          </div>
        </section>

        {showCreateForm && (
          <section className="clustering-create-card">
            <div className="clustering-create-header">
              <h3>Nuevo clustering</h3>
              <p>Selecciona un evidence extraction run completado y define si quieres elegir los clusters automáticamente o de forma manual.</p>
            </div>

            <div className="clustering-form-grid">
              <div className="clustering-field clustering-field-full">
                <span>Evidence extraction base</span>
                <div className="clustering-evidence-picker" role="radiogroup" aria-label="Evidence extraction base">
                  {activeCompletedEvidenceRuns.map((run) => {
                    const isActive = formData.evidenceRunId === run._id
                    return (
                      <button
                        key={run._id}
                        type="button"
                        className={`clustering-evidence-option ${isActive ? 'active' : ''}`}
                        role="radio"
                        aria-checked={isActive}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            evidenceRunId: run._id,
                          }))
                        }
                      >
                        <div className="clustering-evidence-option-top">
                          <span className="clustering-evidence-option-date">{formatTimestamp(run.created_at)}</span>
                          <span className="clustering-evidence-option-summary">
                            {run.processed_articles || 0} / {run.total_articles || 0} artículos
                          </span>
                        </div>
                        <strong>{formatEvidenceMode(run.selection_mode)}</strong>
                        <p>
                          {run.screening_run_id
                            ? 'Filtrado previamente con screening'
                            : 'Construido sobre toda la colección activa'}
                        </p>
                      </button>
                    )
                  })}
                </div>
                {evidenceRunsError && (
                  <small className="clustering-inline-error">{evidenceRunsError}</small>
                )}
                {!evidenceRunsError && !loadingEvidenceRuns && activeCompletedEvidenceRuns.length === 0 && (
                  <small className="clustering-inline-hint">
                    No hay evidence extractions completadas disponibles para esta colección.
                  </small>
                )}
              </div>

              <div className="clustering-field clustering-field-full">
                <span>Modo de agrupación</span>
                <div className="clustering-mode-grid" role="radiogroup" aria-label="Modo de agrupación">
                  {CLUSTER_MODE_OPTIONS.map((option) => {
                    const isActive = formData.clusterMode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`clustering-mode-card ${isActive ? 'active' : ''}`}
                        role="radio"
                        aria-checked={isActive}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            clusterMode: option.value,
                          }))
                        }
                      >
                        <div className="clustering-mode-card-icon">
                          <i className={`fas ${option.icon}`}></i>
                        </div>
                        <div className="clustering-mode-card-copy">
                          <strong>{option.title}</strong>
                          <p>{option.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {formData.clusterMode === 'manual' && (
                <div className="clustering-field">
                  <span>Número de clusters</span>
                  <input
                    type="number"
                    min="2"
                    max="8"
                    className="clustering-number-input"
                    value={formData.clusterCount}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        clusterCount: event.target.value,
                      }))
                    }
                  />
                  <small className="clustering-inline-hint">
                    Si el run tiene pocos artículos, el sistema ajustará automáticamente el máximo útil.
                  </small>
                </div>
              )}
            </div>

            <div className="clustering-create-actions">
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
                disabled={submitting || !formData.evidenceRunId}
              >
                <i className="fas fa-play"></i>
                <span>{submitting ? 'Encolando...' : 'Lanzar clustering'}</span>
              </button>
            </div>
          </section>
        )}

        <div className="clustering-layout">
          <aside className="clustering-runs-panel">
            <div className="clustering-panel-header">
              <div className="clustering-panel-header-main">
                <h3>Ejecuciones guardadas</h3>
                <span>{runs.length}</span>
              </div>
            </div>

            {runsError && <div className="clustering-panel-error">{runsError}</div>}

            {!runsError && runs.length === 0 && !loadingRuns && (
              <div className="clustering-panel-empty">
                <i className="fas fa-object-group"></i>
                <p>No hay clusterings todavía para esta colección.</p>
              </div>
            )}

            <div className="clustering-runs-list">
              {runs.map((run) => {
                const evidenceRun = run.evidence_extraction_run_id
                  ? evidenceRunMap.get(run.evidence_extraction_run_id)
                  : null
                const runIsActive = isActiveRunStatus(run.status)

                return (
                  <article
                    key={run._id}
                    className={`clustering-run-card ${selectedRunId === run._id ? 'active' : ''}`}
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
                    <div className="clustering-run-card-top">
                      <span className={`clustering-status-badge ${run.status || 'queued'}`}>{run.status || 'queued'}</span>
                      <div className="clustering-run-card-meta">
                        <span className="clustering-run-date">{formatTimestamp(run.created_at)}</span>
                        <button
                          type="button"
                          className="clustering-run-card-delete"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (runIsActive) return
                            setRunToDeleteId(run._id)
                            setShowDeleteRunModal(true)
                          }}
                          disabled={deletingRun || runIsActive}
                          aria-label="Eliminar clustering"
                          title={runIsActive ? 'No puedes eliminar un clustering en curso' : 'Eliminar clustering'}
                        >
                          <i className={`fas ${deletingRun && runToDeleteId === run._id ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                        </button>
                      </div>
                    </div>
                    <h4>{run.selected_cluster_count || 0} clusters</h4>
                    <p className="clustering-run-evidence">
                      {evidenceRun ? formatEvidenceMode(evidenceRun.selection_mode) : 'Evidence run base'}
                    </p>
                    <div className="clustering-run-counts">
                      <span className="processed">{run.processed_articles || 0} artículos</span>
                      <span>{formatSilhouette(run.silhouette_score)} silhouette</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </aside>

          <section className="clustering-detail-panel">
            {!selectedRun && !loadingResults && (
              <div className="clustering-detail-empty">
                <i className="fas fa-bezier-curve"></i>
                <h3>Selecciona una ejecución</h3>
                <p>Aquí verás los clusters generados, sus etiquetas y los artículos agrupados dentro de cada uno.</p>
              </div>
            )}

            {selectedRun && (
              <>
                <div className="clustering-detail-header">
                  <div className="clustering-detail-copy">
                    <div className="clustering-detail-title-row">
                      <span className={`clustering-status-badge ${selectedRun.status || 'queued'}`}>
                        {selectedRun.status || 'queued'}
                      </span>
                      <span className="clustering-detail-date">{formatTimestamp(selectedRun.created_at)}</span>
                    </div>
                    <h2>{selectedRun.selected_cluster_count || 0} clusters generados</h2>
                    <p>
                      {selectedEvidenceRun
                        ? `Basado en evidence extraction: ${formatEvidenceMode(selectedEvidenceRun.selection_mode)}`
                        : 'Basado en un evidence extraction run previamente completado'}
                    </p>
                  </div>

                  <div className="clustering-detail-stats">
                    <div className="clustering-metric">
                      <strong>{selectedRun.selected_cluster_count || 0}</strong>
                      <span>Clusters</span>
                    </div>
                    <div className="clustering-metric">
                      <strong>{selectedRun.processed_articles || 0}</strong>
                      <span>Artículos</span>
                    </div>
                    <div className="clustering-metric">
                      <strong>{formatSilhouette(selectedRun.silhouette_score)}</strong>
                      <span>Silhouette</span>
                    </div>
                  </div>
                </div>

                {selectedRun.error_message && (
                  <div className="clustering-panel-error">{selectedRun.error_message}</div>
                )}

                {resultsError && <div className="clustering-panel-error">{resultsError}</div>}

                {loadingResults && (
                  <div className="clustering-detail-empty">
                    <div className="spinner"></div>
                    <p>Cargando resultados de clustering...</p>
                  </div>
                )}

                {!loadingResults && results.length === 0 && (
                  <div className="clustering-detail-empty compact">
                    <i className="fas fa-shapes"></i>
                    <p>
                      {isActiveRunStatus(selectedRun.status)
                        ? 'El clustering sigue en marcha. Los grupos aparecerán aquí en cuanto termine.'
                        : 'No hay artículos agrupados para este run todavía.'}
                    </p>
                  </div>
                )}

                {!loadingResults && groupedClusters.length > 0 && (
                  <div className="clustering-groups-list">
                    {groupedClusters.map((cluster) => (
                      <article key={cluster.cluster_id} className="clustering-group-card">
                        <div className="clustering-group-top">
                          <div>
                            <span className="clustering-group-kicker">Cluster</span>
                            <h3>{cluster.label}</h3>
                          </div>
                          <div className="clustering-group-stats">
                            <span>{cluster.size} artículos</span>
                          </div>
                        </div>

                        <p className="clustering-group-summary">{cluster.summary}</p>
                        <FieldPillList items={cluster.keywords} />

                        <div className="clustering-articles-list">
                          {cluster.items.map((item) => (
                            <article
                              key={`${cluster.cluster_id}:${item.article_id}`}
                              className="clustering-article-card"
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
                              <div className="clustering-article-top">
                                <h4>{item.article_title || formatArticleFallback(item.article_id)}</h4>
                                <span className="clustering-similarity-pill">
                                  Afinidad {formatSimilarity(item.similarity_score)}
                                </span>
                              </div>

                              {item.objective && (
                                <p className="clustering-article-text">
                                  <strong>Objetivo:</strong> {trimText(item.objective)}
                                </p>
                              )}

                              {item.methodology && (
                                <p className="clustering-article-text">
                                  <strong>Metodología:</strong> {trimText(item.methodology)}
                                </p>
                              )}

                              {item.dataset && (
                                <p className="clustering-article-text">
                                  <strong>Dataset:</strong> {trimText(item.dataset, 140)}
                                </p>
                              )}

                              <FieldPillList items={[...(item.variables || []), ...(item.metrics || [])]} />
                            </article>
                          ))}
                        </div>
                      </article>
                    ))}
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
            <div className="modal-content small-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Eliminar clustering</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => {
                    if (!deletingRun) {
                      setShowDeleteRunModal(false)
                      setRunToDeleteId(null)
                    }
                  }}
                  disabled={deletingRun}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>¿Seguro que quieres eliminar este clustering? También se eliminarán las asignaciones de artículos asociadas.</p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowDeleteRunModal(false)
                    setRunToDeleteId(null)
                  }}
                  disabled={deletingRun}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDeleteSelectedRun}
                  disabled={deletingRun}
                >
                  <i className={`fas ${deletingRun ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                  <span>{deletingRun ? 'Eliminando...' : 'Eliminar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Clustering
