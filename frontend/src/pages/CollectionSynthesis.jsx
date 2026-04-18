import { useEffect, useMemo, useRef, useState } from 'react'

import { collectionSynthesisAPI } from '../api/index.js'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import { useIntervalPolling } from '../hooks/useIntervalPolling'
import NotificationToast from '../components/common/NotificationToast'
import { useCollection } from '../context/CollectionContext'
import { createPaperPdfBlob, downloadPdfBlob, openPdfBlob } from '../utils/pdfExport'

import '../styles/App.css'

const PAPER_SECTIONS = [
  'TITULO',
  'RESUMEN',
  'INTRODUCCION',
  'METODOS Y ALCANCE',
  'SINTESIS DE EVIDENCIA',
  'DISCUSION',
  'CONCLUSIONES',
  'REFERENCIAS CITADAS',
]

function formatTimestamp(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function cleanAssistantText(value) {
  if (!value) return ''

  return String(value)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/\*\*/g, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getTextBlocks(value) {
  return cleanAssistantText(value)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function normalizePaperHeading(line) {
  const cleaned = cleanAssistantText(line).replace(/:$/, '').trim().toUpperCase()
  return PAPER_SECTIONS.find((section) => section === cleaned) || null
}

function parsePaperSections(value) {
  const lines = cleanAssistantText(value).split('\n')
  const sections = []
  let currentSection = null
  let currentContent = []

  const pushCurrentSection = () => {
    if (!currentSection) return
    sections.push({
      heading: currentSection,
      content: currentContent.join('\n').trim(),
    })
  }

  lines.forEach((line) => {
    const normalizedHeading = normalizePaperHeading(line)

    if (normalizedHeading) {
      pushCurrentSection()
      currentSection = normalizedHeading
      currentContent = []
      return
    }

    if (!currentSection && line.trim()) {
      currentSection = 'TITULO'
      currentContent = [line]
      return
    }

    currentContent.push(line)
  })

  pushCurrentSection()
  return sections.filter((section) => section.content)
}

function hasPaperStructure(value) {
  return cleanAssistantText(value)
    .split('\n')
    .some((line) => normalizePaperHeading(line))
}

function isReferencesSection(sectionHeading) {
  return sectionHeading === 'REFERENCIAS CITADAS'
}

function normalizeCitationText(value) {
  const cleaned = cleanAssistantText(value)
    .replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, '')
    .replace(/^\[\s*(Paper\s+\d+)\s*:\s*/i, '$1. ')
    .replace(/\]$/, '')
    .trim()

  if (!cleaned) return ''
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

function getCitationEntries(value) {
  const lines = cleanAssistantText(value)
    .split('\n')
    .map((line) => line.trim())

  const entries = []
  let currentEntry = []

  const pushEntry = () => {
    const joinedEntry = normalizeCitationText(currentEntry.join(' '))
    if (joinedEntry) {
      entries.push(joinedEntry)
    }
    currentEntry = []
  }

  lines.forEach((line) => {
    if (!line) {
      if (currentEntry.length > 0) {
        pushEntry()
      }
      return
    }

    const startsNewEntry = /^\s*(?:[-*\u2022]|\d+[.)]|\[\s*Paper\s+\d+\s*:|\[\d+\]|Paper\s+\d+\s*:)/i.test(line)
    if (startsNewEntry && currentEntry.length > 0) {
      pushEntry()
    }

    currentEntry.push(line)
  })

  if (currentEntry.length > 0) {
    pushEntry()
  }

  return entries
}

function renderSectionBlocks(section, runId) {
  if (isReferencesSection(section.heading)) {
    const citations = getCitationEntries(section.content)

    if (citations.length === 0) {
      return getTextBlocks(section.content).map((block, index) => (
        <p key={`${runId}-${section.heading}-${index}`}>{block}</p>
      ))
    }

    return (
      <ol className="collection-synthesis-citations">
        {citations.map((citation, index) => (
          <li key={`${runId}-${section.heading}-citation-${index}`} className="collection-synthesis-citation-item">
            <span className="collection-synthesis-citation-index">{index + 1}</span>
            <p className="collection-synthesis-citation-text">{citation}</p>
          </li>
        ))}
      </ol>
    )
  }

  return getTextBlocks(section.content).map((block, index) => (
    <p key={`${runId}-${section.heading}-${index}`}>{block}</p>
  ))
}

function buildPdfFilename(title) {
  const safeBase = String(title || 'paper-coleccion')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${safeBase || 'paper-coleccion'}.pdf`
}

function isActiveRunStatus(status) {
  return ['queued', 'processing'].includes(status)
}

function CollectionSynthesis() {
  const { selectedCollectionId, collections } = useCollection()

  const [prompt, setPrompt] = useState('')
  const [runs, setRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingRun, setDeletingRun] = useState(false)
  const [showDeleteRunModal, setShowDeleteRunModal] = useState(false)
  const [runToDeleteId, setRunToDeleteId] = useState(null)
  const [notification, setNotification] = useState('')
  const activeCollectionIdRef = useRef(selectedCollectionId)
  const loadRunsRequestIdRef = useRef(0)

  const selectedCollection = collections.find((collection) => collection._id === selectedCollectionId)
  const collectionName = selectedCollection?.name || null
  const selectedRun = useMemo(
    () => runs.find((run) => run._id === selectedRunId) || null,
    [runs, selectedRunId]
  )
  const selectedRunResponseSections = useMemo(() => {
    if (!selectedRun?.response || !hasPaperStructure(selectedRun.response)) {
      return []
    }

    return parsePaperSections(selectedRun.response)
  }, [selectedRun])

  useEffect(() => {
    if (!notification) return undefined

    const timer = setTimeout(() => setNotification(''), 4000)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    activeCollectionIdRef.current = selectedCollectionId
    loadRunsRequestIdRef.current += 1
    setRuns([])
    setSelectedRunId(null)
    setRunToDeleteId(null)

    if (!selectedCollectionId) {
      setLoadingRuns(false)
      return undefined
    }

    loadRuns(selectedCollectionId, null, { preserveSelection: false })
    return undefined
  }, [selectedCollectionId])

  const loadRuns = async (collectionId, preferredRunId = null, options = {}) => {
    const { preserveSelection = true } = options
    const requestId = loadRunsRequestIdRef.current + 1
    loadRunsRequestIdRef.current = requestId

    try {
      setLoadingRuns(true)
      const response = await collectionSynthesisAPI.listRuns(collectionId)
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadRunsRequestIdRef.current !== requestId
      ) {
        return
      }

      const nextRuns = response?.data?.runs || []
      setRuns(nextRuns)

      if (preferredRunId && nextRuns.some((run) => run._id === preferredRunId)) {
        setSelectedRunId(preferredRunId)
        return
      }

      if (
        preserveSelection &&
        selectedRunId &&
        nextRuns.some((run) => run._id === selectedRunId)
      ) {
        return
      }

      setSelectedRunId(nextRuns[0]?._id || null)
    } catch (error) {
      if (
        activeCollectionIdRef.current !== collectionId ||
        loadRunsRequestIdRef.current !== requestId
      ) {
        return
      }
      setNotification(error.message || 'Error al cargar las sintesis guardadas')
    } finally {
      if (
        activeCollectionIdRef.current === collectionId &&
        loadRunsRequestIdRef.current === requestId
      ) {
        setLoadingRuns(false)
      }
    }
  }

  useArticlesEvents({
    onCollectionSynthesisReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Sintesis completada correctamente')
      await loadRuns(selectedCollectionId, data.run_id)
    },
    onCollectionSynthesisError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(data.error_message || 'Error al generar la sintesis')
      await loadRuns(selectedCollectionId, data.run_id)
    },
  }, Boolean(selectedCollectionId))

  useIntervalPolling(() => {
    loadRuns(selectedCollectionId, selectedRun?._id)
  }, {
    enabled: Boolean(selectedCollectionId && selectedRun && ['queued', 'processing'].includes(selectedRun.status)),
    intervalMs: 4000,
  })

  const handleSubmit = async () => {
    const trimmedPrompt = prompt.trim()

    if (!selectedCollectionId || !trimmedPrompt || isSubmitting) {
      return
    }

    try {
      setIsSubmitting(true)
      const response = await collectionSynthesisAPI.runSynthesis(selectedCollectionId, trimmedPrompt)
      const createdRun = response?.data?.run || null

      if (createdRun) {
        await loadRuns(selectedCollectionId, createdRun._id)
      } else {
        await loadRuns(selectedCollectionId)
      }

      setPrompt('')
      setNotification('Sintesis encolada correctamente')
    } catch (error) {
      setNotification(error.message || 'Error al generar la sintesis de la coleccion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGeneratePaper = async (runId) => {
    const run = runs.find((item) => item._id === runId)
    const collectionId = selectedCollectionId
    if (!run || !collectionId) {
      return
    }

    try {
      setRuns((prev) =>
        prev.map((item) =>
          item._id === runId
            ? { ...item, isGeneratingPaper: true }
            : item
        )
      )

      const savedResponse = await collectionSynthesisAPI.generatePaper(runId)
      const updatedRun = savedResponse?.data?.run || null
      if (activeCollectionIdRef.current !== collectionId) {
        return
      }

      if (updatedRun) {
        setRuns((prev) =>
          prev.map((item) =>
            item._id === runId
              ? { ...updatedRun, isGeneratingPaper: false }
              : item
          )
        )
      } else {
        await loadRuns(collectionId, runId)
      }
    } catch (error) {
      if (activeCollectionIdRef.current !== collectionId) {
        return
      }
      setRuns((prev) =>
        prev.map((item) =>
          item._id === runId
            ? { ...item, isGeneratingPaper: false }
            : item
        )
      )
      setNotification(error.message || 'Error al preparar la version paper')
    }
  }

  const handleDeleteRun = async () => {
    if (!runToDeleteId || deletingRun) return
    const runToDelete = runs.find((run) => run._id === runToDeleteId)
    if (runToDelete && isActiveRunStatus(runToDelete.status)) {
      setShowDeleteRunModal(false)
      setRunToDeleteId(null)
      setNotification('No puedes eliminar una sintesis que sigue en cola o en procesamiento')
      return
    }

    try {
      setDeletingRun(true)
      await collectionSynthesisAPI.deleteRun(runToDeleteId)
      setShowDeleteRunModal(false)
      setRunToDeleteId(null)
      await loadRuns(selectedCollectionId)
      setNotification('Sintesis eliminada correctamente')
    } catch (error) {
      setNotification(error.message || 'Error al eliminar la sintesis')
    } finally {
      setDeletingRun(false)
    }
  }

  const handleOpenPdf = (run) => {
    const sections = parsePaperSections(run.paper_response)
    if (sections.length === 0) {
      setNotification('La version paper no tiene contenido suficiente para generar PDF')
      return
    }

    const blob = createPaperPdfBlob({
      title: run.paper_title || 'Paper de coleccion',
      collectionName,
      sections,
    })
    openPdfBlob(blob)
  }

  const handleDownloadPdf = (run) => {
    const sections = parsePaperSections(run.paper_response)
    if (sections.length === 0) {
      setNotification('La version paper no tiene contenido suficiente para generar PDF')
      return
    }

    const blob = createPaperPdfBlob({
      title: run.paper_title || 'Paper de coleccion',
      collectionName,
      sections,
    })
    downloadPdfBlob(blob, buildPdfFilename(run.paper_title || run.prompt))
  }

  if (!selectedCollectionId) {
    return (
      <div className="page-container collection-empty-state-page">
        <div className="collection-empty-state-card">
          <div className="collection-empty-state-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <h1>Selecciona una coleccion</h1>
          <p>Collection Synthesis trabaja sobre una coleccion concreta. Elige una en la barra superior para empezar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container collection-synthesis-page">
      <div className="container">
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Collection Synthesis</h1>
              <span className="header-subtitle">Coleccion activa: {collectionName}</span>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{runs.length}</span>
                <span className="stat-label">Sintesis</span>
              </div>
            </div>
          </div>
        </div>

        <section className="collection-synthesis-toolbar">
          <div className="collection-synthesis-toolbar-copy">
            <h2>Sintesis guardadas</h2>
            <p>Cada consulta queda registrada en esta coleccion para poder retomarla despues.</p>
          </div>
        </section>

        <div className="collection-synthesis-layout">
          <aside className="collection-synthesis-info">
            <div className="collection-synthesis-card-header">
              <div>
                <h2>Nueva sintesis</h2>
                <p>Haz una pregunta concreta y la respuesta quedara guardada como un run.</p>
              </div>
            </div>

            <textarea
              className="collection-synthesis-textarea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ejemplo: sintetiza las contradicciones principales de la coleccion y concluye en 5-6 frases."
              rows={8}
              disabled={isSubmitting}
            />

            <div className="collection-synthesis-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !prompt.trim()}
              >
                <i className={`fas ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                <span>{isSubmitting ? 'Generando sintesis...' : 'Generar sintesis'}</span>
              </button>
            </div>

            <div className="collection-synthesis-tip-list">
              <div className="collection-synthesis-tip">
                <strong>Ejemplo</strong>
                <span>Resume los hallazgos principales en tres ideas clave.</span>
              </div>
              <div className="collection-synthesis-tip">
                <strong>Ejemplo</strong>
                <span>Compara los articulos sobre metodologia, resultados y limitaciones.</span>
              </div>
              <div className="collection-synthesis-tip">
                <strong>Ejemplo</strong>
                <span>Detecta vacios de investigacion y una recomendacion final.</span>
              </div>
            </div>
          </aside>

          <section className="collection-synthesis-main">
            <div className="screening-layout">
              <aside className="screening-runs-panel">
                <div className="screening-panel-header">
                  <div className="screening-panel-header-main">
                    <h3>Ejecuciones guardadas</h3>
                    <span>{runs.length}</span>
                  </div>
                </div>

                {loadingRuns && (
                  <div className="screening-panel-empty">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Cargando sintesis...</p>
                  </div>
                )}

                {!loadingRuns && runs.length === 0 && (
                  <div className="screening-panel-empty">
                    <i className="fas fa-diagram-project"></i>
                    <p>No hay sintesis guardadas todavia para esta coleccion.</p>
                  </div>
                )}

                <div className="screening-runs-list">
                  {runs.map((run) => {
                    const runIsActive = isActiveRunStatus(run.status)

                    return (
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
                          <span className={`screening-status-badge ${run.status || 'processing'}`}>{run.status || 'processing'}</span>
                          <div className="screening-run-card-meta">
                            <span className="screening-run-date">{formatTimestamp(run.created_at)}</span>
                            <button
                              type="button"
                              className="screening-run-card-delete"
                              onClick={(event) => {
                                event.stopPropagation()
                                if (runIsActive) {
                                  return
                                }
                                setRunToDeleteId(run._id)
                                setShowDeleteRunModal(true)
                              }}
                              disabled={deletingRun || runIsActive}
                              aria-label={`Eliminar sintesis ${run.prompt}`}
                              title={
                                runIsActive
                                  ? 'No disponible mientras la sintesis esta activa'
                                  : 'Eliminar sintesis'
                              }
                            >
                              <i className={`fas ${deletingRun && runToDeleteId === run._id ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                            </button>
                          </div>
                        </div>
                        <h4>{run.prompt}</h4>
                      </article>
                    )
                  })}
                </div>
              </aside>

              <section className="screening-detail-panel">
                {!selectedRun && !loadingRuns && (
                  <div className="collection-synthesis-empty">
                    <i className="fas fa-diagram-project"></i>
                    <h3>Sin sintesis seleccionada</h3>
                    <p>Elige una ejecucion guardada o crea una nueva consulta para esta coleccion.</p>
                  </div>
                )}

                {selectedRun && (
                  <article className="collection-synthesis-result-card collection-synthesis-detail-card">
                    <div className="collection-synthesis-result-top">
                      <div>
                        <span className="collection-synthesis-result-label">Prompt</span>
                        <h3>{selectedRun.prompt}</h3>
                      </div>
                      <div className="screening-result-meta">
                        <span className={`screening-status-badge ${selectedRun.status || 'queued'}`}>
                          {selectedRun.status || 'queued'}
                        </span>
                        <span className="collection-synthesis-result-date">{formatTimestamp(selectedRun.created_at)}</span>
                      </div>
                    </div>

                    {selectedRun.error_message && (
                      <div className="screening-panel-error">{selectedRun.error_message}</div>
                    )}

                    {selectedRun.status === 'queued' && (
                      <div className="collection-synthesis-empty">
                        <i className="fas fa-clock"></i>
                        <h3>Sintesis en cola</h3>
                        <p>El worker la procesara en cuanto llegue su turno.</p>
                      </div>
                    )}

                    {selectedRun.status === 'processing' && (
                      <div className="collection-synthesis-empty">
                        <i className="fas fa-spinner fa-spin"></i>
                        <h3>Generando sintesis</h3>
                        <p>La consulta se esta resolviendo ahora mismo para esta coleccion.</p>
                      </div>
                    )}

                    {selectedRun.status === 'completed' && (
                      <div className="collection-synthesis-result-body">
                        <span className="collection-synthesis-result-label">Respuesta</span>
                        {selectedRunResponseSections.length > 0 ? (
                          <div className="collection-synthesis-paper-content">
                            {selectedRunResponseSections.map((section) => (
                              <section
                                key={`${selectedRun._id}-response-${section.heading}`}
                                className="collection-synthesis-paper-section"
                              >
                                <h5>{section.heading}</h5>
                                {renderSectionBlocks(section, `${selectedRun._id}-response`)}
                              </section>
                            ))}
                          </div>
                        ) : (
                          <div className="collection-synthesis-text-blocks">
                            {getTextBlocks(selectedRun.response).map((block, index) => (
                              <p key={`${selectedRun._id}-paragraph-${index}`}>{block}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="collection-synthesis-result-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleGeneratePaper(selectedRun._id)}
                        disabled={selectedRun.isGeneratingPaper || selectedRun.status !== 'completed' || !selectedRun.response}
                      >
                        <i className={`fas ${selectedRun.isGeneratingPaper ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
                        <span>{selectedRun.isGeneratingPaper ? 'Preparando paper...' : 'Preparar paper PDF'}</span>
                      </button>

                      {selectedRun.paper_response && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleOpenPdf(selectedRun)}
                          >
                            <i className="fas fa-eye"></i>
                            <span>Ver PDF</span>
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleDownloadPdf(selectedRun)}
                          >
                            <i className="fas fa-download"></i>
                            <span>Descargar PDF</span>
                          </button>
                        </>
                      )}
                    </div>

                    {selectedRun.paper_response && (
                      <div className="collection-synthesis-paper-preview">
                        <div className="collection-synthesis-paper-preview-header">
                          <div>
                            <span className="collection-synthesis-result-label">Vista paper</span>
                            <h4>{selectedRun.paper_title || 'Paper de coleccion'}</h4>
                          </div>
                        </div>

                        <div className="collection-synthesis-paper-content">
                          {parsePaperSections(selectedRun.paper_response).map((section) => (
                            <section key={`${selectedRun._id}-${section.heading}`} className="collection-synthesis-paper-section">
                              <h5>{section.heading}</h5>
                              {renderSectionBlocks(section, selectedRun._id)}
                            </section>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                )}
              </section>
            </div>
          </section>
        </div>

        <NotificationToast message={notification} onClose={() => setNotification('')} />

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
                  {' '}Eliminar sintesis
                </h2>
              </div>
              <div className="modal-body">
                <p>¿Seguro que quieres eliminar esta sintesis guardada?</p>
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
                  onClick={handleDeleteRun}
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

export default CollectionSynthesis
