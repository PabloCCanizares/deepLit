import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { collectionsAPI, screeningAPI } from '../api/index.js'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import CreateCollectionModal from '../components/collections/CreateCollectionModal'
import NotificationToast from '../components/common/NotificationToast'
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
  review: 'En revision',
  exclude: 'Excluido',
}

const DECISION_COLLECTION_SUFFIX = {
  include: 'incluidos',
  review: 'en revision',
  exclude: 'excluidos',
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

function buildCollectionName(baseName, decisionLabel) {
  const rawName = `${baseName || 'Coleccion'} - ${decisionLabel}`
  return rawName.length > 100 ? rawName.slice(0, 100).trim() : rawName
}

function Screening() {
  const navigate = useNavigate()
  const { selectedCollectionId, collections, refreshCollections } = useCollection()

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
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false)
  const [showDeleteRunModal, setShowDeleteRunModal] = useState(false)
  const [runToDeleteId, setRunToDeleteId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [deletingRun, setDeletingRun] = useState(false)
  const [updatingResultId, setUpdatingResultId] = useState(null)
  const [notification, setNotification] = useState('')
  const [collectionFormData, setCollectionFormData] = useState({
    name: '',
    description: '',
  })
  const [formData, setFormData] = useState({
    researchQuestion: '',
    inclusionCriteria: '',
    exclusionCriteria: '',
  })

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

  const filteredCount = filteredResults.length

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
      setRunToDeleteId(null)
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
      setRunsError(err.message || 'Error al cargar cribados')
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
      setResultsError(err.message || 'Error al cargar resultados del cribado')
    } finally {
      setLoadingResults(false)
    }
  }

  useArticlesEvents({
    onScreeningReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Cribado completado correctamente')
      await loadRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) {
        await loadRunResults(data.run_id)
      }
    },
    onScreeningError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(`Error en cribado: ${data.error_message || 'Error desconocido'}`)
      await loadRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) {
        await loadRunResults(data.run_id)
      }
    },
  }, Boolean(selectedCollectionId))

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

      setNotification('Cribado encolado correctamente')
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
      setNotification(err.message || 'Error al lanzar el cribado')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenArticle = (articleId) => {
    if (!articleId) return

    navigate(`/articles/${encodeURIComponent(articleId)}`, {
      state: {
        from: 'screening',
        collectionId: selectedCollectionId,
        runId: selectedRunId,
      },
    })
  }

  const handleCreateCollectionFromResults = async () => {
    if (!selectedCollectionId || !selectedRun || decisionFilter === 'all' || filteredResults.length === 0) {
      return
    }

    const decisionLabel = DECISION_LABELS[decisionFilter]
    const decisionSuffix = DECISION_COLLECTION_SUFFIX[decisionFilter]
    const newCollectionName = buildCollectionName(collectionName, decisionLabel)

    setCollectionFormData({
      name: newCollectionName,
      description: `Coleccion generada desde el cribado "${selectedRun.research_question}" con articulos ${decisionSuffix}.`,
    })
    setShowCreateCollectionModal(true)
  }

  const handleConfirmCreateCollectionFromResults = async (collectionData) => {
    if (
      !selectedCollectionId ||
      !selectedRun ||
      decisionFilter === 'all' ||
      filteredResults.length === 0 ||
      creatingCollection
    ) {
      return
    }

    const newCollectionName = (collectionData?.name || '').trim()
    const newCollectionDescription = (collectionData?.description || '').trim()
    const collectionImage = collectionData?.image || null

    if (!newCollectionName) {
      setNotification('Introduce un nombre para la coleccion')
      return
    }

    try {
      setCreatingCollection(true)

      const response = await collectionsAPI.create({
        name: newCollectionName,
        description: newCollectionDescription,
        color: '#3B82F6',
        image: collectionImage,
      })

      const createdCollectionId = response?.data?._id
      if (!createdCollectionId) {
        throw new Error('No se pudo crear la coleccion')
      }

      await Promise.all(
        filteredResults.map((item) => collectionsAPI.addArticle(createdCollectionId, item.article_id))
      )

      await refreshCollections()
      setShowCreateCollectionModal(false)
      setNotification(`Coleccion "${newCollectionName}" creada correctamente`)
    } catch (err) {
      setNotification(err.message || 'Error al crear la coleccion desde los resultados')
    } finally {
      setCreatingCollection(false)
    }
  }

  const handleDeleteSelectedRun = async () => {
    if (!runToDeleteId || deletingRun) return

    const deletingSelectedRun = runToDeleteId === selectedRunId

    try {
      setDeletingRun(true)
      await screeningAPI.deleteRun(runToDeleteId)
      setShowDeleteRunModal(false)
      setRunToDeleteId(null)

      if (deletingSelectedRun) {
        setSelectedRun(null)
        setResults([])
      }

      await loadRuns({ preserveSelection: !deletingSelectedRun })
      setNotification('Cribado eliminado correctamente')
    } catch (err) {
      setNotification(err.message || 'Error al eliminar el cribado')
    } finally {
      setDeletingRun(false)
    }
  }

  const handleMoveReviewResult = async (item, nextDecision) => {
    if (!selectedRunId || !item?.article_id || updatingResultId) return

    try {
      setUpdatingResultId(item.article_id)
      const response = await screeningAPI.updateRunResult(selectedRunId, item.article_id, {
        decision: nextDecision,
        reason:
          nextDecision === 'include'
            ? 'Decision ajustada manualmente a incluido desde Cribado.'
            : 'Decision ajustada manualmente a excluido desde Cribado.',
      })

      const updatedRun = response?.data?.run || null
      const updatedResult = response?.data?.result || null

      if (updatedRun) {
        setSelectedRun(updatedRun)
        setRuns((prev) =>
          prev.map((run) => (run._id === updatedRun._id ? updatedRun : run))
        )
      }

      if (updatedResult) {
        setResults((prev) =>
          prev.map((currentItem) =>
            currentItem.article_id === item.article_id ? updatedResult : currentItem
          )
        )
      } else {
        await loadRunResults(selectedRunId)
      }

      setNotification(
        nextDecision === 'include'
          ? 'Articulo movido a incluidos'
          : 'Articulo movido a excluidos'
      )
    } catch (err) {
      setNotification(err.message || 'Error al actualizar la decision del articulo')
    } finally {
      setUpdatingResultId(null)
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
          <p>Cribado trabaja sobre una colección concreta. Elige una en la barra superior para empezar.</p>
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
              <span>{showCreateForm ? 'Ocultar formulario' : 'Nuevo cribado'}</span>
            </button>
          </div>
        </section>

        {showCreateForm && (
          <section className="screening-create-card">
            <div className="screening-create-header">
              <h3>Nuevo cribado</h3>
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
                <span>{submitting ? 'Encolando...' : 'Lanzar cribado'}</span>
              </button>
            </div>
          </section>
        )}

        <div className="screening-layout">
          <aside className="screening-runs-panel">
            <div className="screening-panel-header">
              <div className="screening-panel-header-main">
                <h3>Ejecuciones guardadas</h3>
                <span>{runs.length}</span>
              </div>
            </div>

            {runsError && <div className="screening-panel-error">{runsError}</div>}

            {!runsError && runs.length === 0 && !loadingRuns && (
              <div className="screening-panel-empty">
                <i className="fas fa-layer-group"></i>
                <p>No hay cribados todavía para esta colección.</p>
              </div>
            )}

            <div className="screening-runs-list">
              {runs.map((run) => (
                <article
                  key={run._id}
                  className={`screening-run-card ${selectedRunId === run._id ? 'active' : ''}`}
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
                  <div className="screening-run-card-top">
                    <span className={`screening-status-badge ${run.status || 'queued'}`}>{run.status || 'queued'}</span>
                    <div className="screening-run-card-meta">
                      <span className="screening-run-date">{formatDateTime(run.created_at)}</span>
                      <button
                        type="button"
                        className="screening-run-card-delete"
                        onClick={(event) => {
                          event.stopPropagation()
                          setRunToDeleteId(run._id)
                          setShowDeleteRunModal(true)
                        }}
                        disabled={deletingRun}
                        aria-label={`Eliminar cribado ${run.research_question}`}
                        title="Eliminar cribado"
                      >
                        <i className={`fas ${deletingRun && runToDeleteId === run._id ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                      </button>
                    </div>
                  </div>
                  <h4>{run.research_question}</h4>
                  <div className="screening-run-counts">
                    <span className="include">{run.counts?.include || 0} incluidos</span>
                    <span className="review">{run.counts?.review || 0} revision</span>
                    <span className="exclude">{run.counts?.exclude || 0} excluidos</span>
                  </div>
                </article>
              ))}
            </div>
          </aside>

          <section className="screening-detail-panel">
            {!selectedRun && !loadingResults && (
              <div className="screening-detail-empty">
                <i className="fas fa-magnifying-glass-chart"></i>
                <h3>Selecciona un cribado</h3>
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
                      <span>Incluidos</span>
                    </div>
                    <div className="screening-metric review">
                      <strong>{activeCounts.review || 0}</strong>
                      <span>Revision</span>
                    </div>
                    <div className="screening-metric exclude">
                      <strong>{activeCounts.exclude || 0}</strong>
                      <span>Excluidos</span>
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

                {decisionFilter !== 'all' && !loadingResults && (
                  <div className="screening-actions-row">
                    <div className="screening-actions-copy">
                      <strong>{filteredCount}</strong>
                      <span> articulos en {DECISION_LABELS[decisionFilter].toLowerCase()}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCreateCollectionFromResults}
                      disabled={creatingCollection || filteredResults.length === 0}
                    >
                      <i className="fas fa-folder-plus"></i>
                      <span>{creatingCollection ? 'Creando coleccion...' : `Crear coleccion de ${DECISION_LABELS[decisionFilter].toLowerCase()}`}</span>
                    </button>
                  </div>
                )}

                {resultsError && <div className="screening-panel-error">{resultsError}</div>}

                {loadingResults && (
                  <div className="screening-detail-empty">
                    <div className="spinner"></div>
                    <p>Cargando resultados del cribado...</p>
                  </div>
                )}

                {!loadingResults && filteredResults.length === 0 && (
                  <div className="screening-detail-empty compact">
                    <i className="fas fa-file-circle-question"></i>
                    <p>
                      {['queued', 'processing'].includes(selectedRun.status)
                        ? 'El cribado sigue en marcha. Los resultados aparecerán aquí en cuanto termine.'
                        : 'No hay artículos para este filtro todavía.'}
                    </p>
                  </div>
                )}

                {!loadingResults && filteredResults.length > 0 && (
                  <div className="screening-results-list">
                    {filteredResults.map((item) => (
                      <article
                        key={`${item.run_id}:${item.article_id}`}
                        className="screening-result-card"
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
                        {item.decision === 'review' && (
                          <div className="screening-result-actions">
                            <button
                              type="button"
                              className="screening-inline-action include"
                              disabled={updatingResultId === item.article_id}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleMoveReviewResult(item, 'include')
                              }}
                            >
                              <i className="fas fa-check"></i>
                              <span>Pasar a incluidos</span>
                            </button>
                            <button
                              type="button"
                              className="screening-inline-action exclude"
                              disabled={updatingResultId === item.article_id}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleMoveReviewResult(item, 'exclude')
                              }}
                            >
                              <i className="fas fa-times"></i>
                              <span>Pasar a excluidos</span>
                            </button>
                          </div>
                        )}
                        <div className="screening-result-footer">
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

        <NotificationToast message={notification} onClose={() => setNotification('')} />

        <CreateCollectionModal
          isOpen={showCreateCollectionModal}
          onClose={() => !creatingCollection && setShowCreateCollectionModal(false)}
          onSave={handleConfirmCreateCollectionFromResults}
          allowArticleSelection={false}
          initialData={collectionFormData}
        />

        {showDeleteRunModal && (
          <div className="modal-overlay" onClick={() => {
            if (!deletingRun) {
              setShowDeleteRunModal(false)
              setRunToDeleteId(null)
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <i className="fas fa-exclamation-triangle" style={{ color: 'var(--color-danger)' }}></i>
                  {' '}Eliminar cribado
                </h2>
              </div>
              <div className="modal-body">
                <p>¿Seguro que quieres eliminar este cribado y todos sus resultados guardados?</p>
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

export default Screening
