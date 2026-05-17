import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { collectionSynthesisAPI, evidenceExtractionAPI, redactionAPI } from '../api/index.js'
import NotificationToast from '../components/common/NotificationToast'
import { useCollection } from '../context/CollectionContext'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import { useIntervalPolling } from '../hooks/useIntervalPolling'
import { createPaperPdfBlob, downloadPdfBlob, openPdfBlob } from '../utils/pdfExport'

import '../styles/App.css'
import '../styles/workspace/ScientificWriting.css'

const TEXT_TYPE_OPTIONS = [
  { value: 'summary', label: 'Resumen', icon: 'fa-align-left' },
  { value: 'introduction', label: 'Introduccion', icon: 'fa-door-open' },
  { value: 'state_of_the_art', label: 'Estado de la cuestion', icon: 'fa-book-open' },
  { value: 'conclusions', label: 'Conclusiones', icon: 'fa-flag-checkered' },
  { value: 'full_draft', label: 'Borrador completo', icon: 'fa-file-lines' },
]

const DRAFT_SECTION_HEADINGS = [
  'APORTACION DEL USUARIO',
  'EVIDENCIA UTILIZADA',
  'BORRADOR',
  'PUNTOS A REVISAR',
  'LIMITACIONES DEL SOPORTE',
]

function isActiveRunStatus(status) {
  return ['queued', 'processing'].includes(status)
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

function truncateText(value, maxLength = 900) {
  const text = cleanAssistantText(value)
  if (!text || text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength).split(' ').slice(0, -1).join(' ').trim()
  return `${truncated || text.slice(0, maxLength)}...`
}

function normalizeHeading(value) {
  const cleaned = cleanAssistantText(value).replace(/:$/, '').trim().toUpperCase()
  return DRAFT_SECTION_HEADINGS.find((heading) => heading === cleaned) || null
}

function parseDraftSections(value) {
  const lines = cleanAssistantText(value).split('\n')
  const sections = []
  let currentHeading = null
  let currentContent = []

  const pushSection = () => {
    if (!currentHeading) return
    const content = currentContent.join('\n').trim()
    if (content) sections.push({ heading: currentHeading, content })
  }

  lines.forEach((line) => {
    const heading = normalizeHeading(line)
    if (heading) {
      pushSection()
      currentHeading = heading
      currentContent = []
      return
    }

    if (!currentHeading && line.trim()) {
      currentHeading = 'BORRADOR'
    }

    currentContent.push(line)
  })

  pushSection()
  return sections
}

function sortRunsByDate(runs) {
  return [...runs].sort((first, second) => {
    const firstDate = new Date(first.created_at || 0).getTime()
    const secondDate = new Date(second.created_at || 0).getTime()
    return secondDate - firstDate
  })
}

function getDraftTitle(run) {
  return run?.result?.title || 'Borrador cientifico'
}

function getDraftText(run) {
  return run?.result?.draft_text || ''
}

function getSynthesisTitle(run) {
  if (!run) return 'Sin sintesis'
  return `Sintesis: ${truncateText(run.prompt || 'Sin prompt', 80)}`
}

function resolveRunSelection(runs, currentId, preferredId) {
  if (preferredId && runs.some((run) => run._id === preferredId)) {
    return preferredId
  }

  if (currentId && runs.some((run) => run._id === currentId)) {
    return currentId
  }

  return runs[0]?._id || null
}

function formatEvidenceMode(value) {
  const labels = {
    all: 'Toda la coleccion',
    screening_include: 'Incluidos de screening',
    screening_include_review: 'Incluidos + revision',
  }
  return labels[value] || value || 'Sin modo'
}

function buildPdfFilename(collectionName, run) {
  const base = `${collectionName || 'coleccion'}-${getDraftTitle(run)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'borrador-cientifico'}.pdf`
}

function getDraftPdfSections(text) {
  const parsedSections = parseDraftSections(text || '')
  if (parsedSections.length > 0) return parsedSections

  const cleanedText = cleanAssistantText(text)
  return cleanedText ? [{ heading: 'BORRADOR', content: cleanedText }] : []
}

function ScientificWriting({ embedded = false }) {
  const { selectedCollectionId, collections } = useCollection()

  const [textType, setTextType] = useState('summary')
  const [userIdeas, setUserIdeas] = useState('')

  const [synthesisRuns, setSynthesisRuns] = useState([])
  const [redactionRuns, setRedactionRuns] = useState([])
  const [evidenceRuns, setEvidenceRuns] = useState([])
  const [evidenceResults, setEvidenceResults] = useState([])
  const [selectedSynthesisRunId, setSelectedSynthesisRunId] = useState(null)
  const [selectedEvidenceRunId, setSelectedEvidenceRunId] = useState(null)
  const [selectedEvidenceRun, setSelectedEvidenceRun] = useState(null)
  const [selectedDraftRunId, setSelectedDraftRunId] = useState(null)

  const [loadingSynthesisRuns, setLoadingSynthesisRuns] = useState(false)
  const [loadingRedactionRuns, setLoadingRedactionRuns] = useState(false)
  const [loadingEvidenceRuns, setLoadingEvidenceRuns] = useState(false)
  const [loadingEvidenceResults, setLoadingEvidenceResults] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRequestingRevision, setIsRequestingRevision] = useState(false)
  const [notification, setNotification] = useState('')
  const [revisionInstruction, setRevisionInstruction] = useState('')

  const activeCollectionIdRef = useRef(selectedCollectionId)
  const selectedDraftRunIdRef = useRef(selectedDraftRunId)
  const selectedSynthesisRunIdRef = useRef(selectedSynthesisRunId)
  const selectedEvidenceRunIdRef = useRef(selectedEvidenceRunId)
  const synthesisRequestIdRef = useRef(0)
  const redactionRequestIdRef = useRef(0)
  const evidenceRunsRequestIdRef = useRef(0)
  const evidenceResultsRequestIdRef = useRef(0)

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection._id === selectedCollectionId) || null,
    [collections, selectedCollectionId]
  )
  const collectionName = selectedCollection?.name || null

  const draftRuns = useMemo(
    () => sortRunsByDate(redactionRuns),
    [redactionRuns]
  )
  const completedSynthesisRuns = useMemo(
    () => sortRunsByDate(synthesisRuns.filter((run) => run.status === 'completed')),
    [synthesisRuns]
  )
  const completedEvidenceRuns = useMemo(
    () => sortRunsByDate(evidenceRuns.filter((run) => run.status === 'completed')),
    [evidenceRuns]
  )
  const selectedDraftRun = useMemo(
    () => draftRuns.find((run) => run._id === selectedDraftRunId) || null,
    [draftRuns, selectedDraftRunId]
  )
  const selectedDraftText = useMemo(
    () => (selectedDraftRun ? getDraftText(selectedDraftRun) : ''),
    [selectedDraftRun]
  )
  const selectedDraftSections = useMemo(
    () => (selectedDraftText ? parseDraftSections(selectedDraftText) : []),
    [selectedDraftText]
  )
  const selectedDraftReferences = useMemo(() => {
    const references = selectedDraftRun?.result?.references
    return Array.isArray(references) ? references : []
  }, [selectedDraftRun])
  const selectedSynthesisRun = useMemo(
    () => synthesisRuns.find((run) => run._id === selectedSynthesisRunId) || null,
    [synthesisRuns, selectedSynthesisRunId]
  )
  const selectedReviewPoints = useMemo(() => {
    if (!selectedDraftRun || selectedDraftRun.status !== 'completed') return []
    const points = selectedDraftRun.result?.review_points
    return Array.isArray(points) ? points.filter((item) => typeof item === 'string' && item.trim()) : []
  }, [selectedDraftRun])
  const activeDraftRuns = useMemo(
    () => draftRuns.filter((run) => isActiveRunStatus(run.status)).length,
    [draftRuns]
  )

  useEffect(() => {
    selectedDraftRunIdRef.current = selectedDraftRunId
  }, [selectedDraftRunId])

  useEffect(() => {
    selectedSynthesisRunIdRef.current = selectedSynthesisRunId
  }, [selectedSynthesisRunId])

  useEffect(() => {
    selectedEvidenceRunIdRef.current = selectedEvidenceRunId
  }, [selectedEvidenceRunId])

  useEffect(() => {
    if (!notification) return undefined
    const timer = setTimeout(() => setNotification(''), 4500)
    return () => clearTimeout(timer)
  }, [notification])

  useEffect(() => {
    setRevisionInstruction('')
  }, [selectedDraftRunId])

  const loadSynthesisRuns = useCallback(async (collectionId, options = {}) => {
    const { preserveSelection = true } = options
    if (!collectionId) return

    const requestId = synthesisRequestIdRef.current + 1
    synthesisRequestIdRef.current = requestId

    try {
      setLoadingSynthesisRuns(true)
      const response = await collectionSynthesisAPI.listRuns(collectionId)
      if (activeCollectionIdRef.current !== collectionId || synthesisRequestIdRef.current !== requestId) return

      const nextRuns = response?.data?.runs || []
      setSynthesisRuns(nextRuns)

      const currentSynthesisId = preserveSelection ? selectedSynthesisRunIdRef.current : null
      setSelectedSynthesisRunId(
        currentSynthesisId && nextRuns.some((run) => run._id === currentSynthesisId)
          ? currentSynthesisId
          : null
      )
    } catch (error) {
      if (activeCollectionIdRef.current !== collectionId || synthesisRequestIdRef.current !== requestId) return
      setNotification(error.message || 'Error al cargar las sintesis guardadas')
    } finally {
      if (activeCollectionIdRef.current === collectionId && synthesisRequestIdRef.current === requestId) {
        setLoadingSynthesisRuns(false)
      }
    }
  }, [])

  const loadRedactionRuns = useCallback(async (collectionId, preferredRunId = null, options = {}) => {
    const { preserveSelection = true } = options
    if (!collectionId) return

    const requestId = redactionRequestIdRef.current + 1
    redactionRequestIdRef.current = requestId

    try {
      setLoadingRedactionRuns(true)
      const response = await redactionAPI.listRuns(collectionId)
      if (activeCollectionIdRef.current !== collectionId || redactionRequestIdRef.current !== requestId) return

      const nextRuns = sortRunsByDate(response?.data?.runs || [])
      setRedactionRuns(nextRuns)

      setSelectedDraftRunId(resolveRunSelection(
        nextRuns,
        preserveSelection ? selectedDraftRunIdRef.current : null,
        preferredRunId
      ))
    } catch (error) {
      if (activeCollectionIdRef.current !== collectionId || redactionRequestIdRef.current !== requestId) return
      setNotification(error.message || 'Error al cargar los borradores')
    } finally {
      if (activeCollectionIdRef.current === collectionId && redactionRequestIdRef.current === requestId) {
        setLoadingRedactionRuns(false)
      }
    }
  }, [])

  const loadEvidenceRuns = useCallback(async (collectionId, options = {}) => {
    const { preserveSelection = true } = options
    if (!collectionId) return

    const requestId = evidenceRunsRequestIdRef.current + 1
    evidenceRunsRequestIdRef.current = requestId

    try {
      setLoadingEvidenceRuns(true)
      const response = await evidenceExtractionAPI.listRuns(collectionId)
      if (activeCollectionIdRef.current !== collectionId || evidenceRunsRequestIdRef.current !== requestId) return

      const nextRuns = response?.data?.runs || []
      setEvidenceRuns(nextRuns)

      const currentEvidenceId = preserveSelection ? selectedEvidenceRunIdRef.current : null
      setSelectedEvidenceRunId(
        currentEvidenceId && nextRuns.some((run) => run._id === currentEvidenceId && run.status === 'completed')
          ? currentEvidenceId
          : null
      )
    } catch (error) {
      if (activeCollectionIdRef.current !== collectionId || evidenceRunsRequestIdRef.current !== requestId) return
      setNotification(error.message || 'Error al cargar evidence extractions')
    } finally {
      if (activeCollectionIdRef.current === collectionId && evidenceRunsRequestIdRef.current === requestId) {
        setLoadingEvidenceRuns(false)
      }
    }
  }, [])

  const loadEvidenceResults = useCallback(async (runId) => {
    if (!runId) {
      setSelectedEvidenceRun(null)
      setEvidenceResults([])
      return
    }

    const requestId = evidenceResultsRequestIdRef.current + 1
    evidenceResultsRequestIdRef.current = requestId

    try {
      setLoadingEvidenceResults(true)
      const response = await evidenceExtractionAPI.getRunResults(runId)
      if (evidenceResultsRequestIdRef.current !== requestId) return
      setSelectedEvidenceRun(response?.data?.run || null)
      setEvidenceResults(response?.data?.results || [])
    } catch (error) {
      if (evidenceResultsRequestIdRef.current !== requestId) return
      setSelectedEvidenceRun(null)
      setEvidenceResults([])
      setNotification(error.message || 'Error al cargar las fichas de evidencia')
    } finally {
      if (evidenceResultsRequestIdRef.current === requestId) {
        setLoadingEvidenceResults(false)
      }
    }
  }, [])

  useEffect(() => {
    activeCollectionIdRef.current = selectedCollectionId
    synthesisRequestIdRef.current += 1
    redactionRequestIdRef.current += 1
    evidenceRunsRequestIdRef.current += 1
    evidenceResultsRequestIdRef.current += 1

    setSynthesisRuns([])
    setRedactionRuns([])
    setEvidenceRuns([])
    setEvidenceResults([])
    setSelectedSynthesisRunId(null)
    setSelectedEvidenceRunId(null)
    setSelectedEvidenceRun(null)
    setSelectedDraftRunId(null)

    if (!selectedCollectionId) {
      setLoadingSynthesisRuns(false)
      setLoadingRedactionRuns(false)
      setLoadingEvidenceRuns(false)
      setLoadingEvidenceResults(false)
      return
    }

    loadSynthesisRuns(selectedCollectionId, { preserveSelection: false })
    loadRedactionRuns(selectedCollectionId, null, { preserveSelection: false })
    loadEvidenceRuns(selectedCollectionId, { preserveSelection: false })
  }, [loadEvidenceRuns, loadRedactionRuns, loadSynthesisRuns, selectedCollectionId])

  useEffect(() => {
    loadEvidenceResults(selectedEvidenceRunId)
  }, [loadEvidenceResults, selectedEvidenceRunId])

  useArticlesEvents({
    onRedactionReady: async (data) => {
      if (data.collection_id !== activeCollectionIdRef.current) return
      setNotification('Borrador completado correctamente')
      await loadRedactionRuns(data.collection_id, data.run_id)
    },
    onRedactionError: async (data) => {
      if (data.collection_id !== activeCollectionIdRef.current) return
      setNotification(data.error_message || 'Error al generar el borrador')
      await loadRedactionRuns(data.collection_id, data.run_id)
    },
    onCollectionSynthesisReady: async (data) => {
      if (data.collection_id !== activeCollectionIdRef.current) return
      await loadSynthesisRuns(data.collection_id)
    },
    onCollectionSynthesisError: async (data) => {
      if (data.collection_id !== activeCollectionIdRef.current) return
      await loadSynthesisRuns(data.collection_id)
    },
    onEvidenceExtractionReady: async (data) => {
      if (data.collection_id !== activeCollectionIdRef.current) return
      await loadEvidenceRuns(data.collection_id)
      if (selectedEvidenceRunIdRef.current === data.run_id) {
        await loadEvidenceResults(data.run_id)
      }
    },
  }, Boolean(selectedCollectionId))

  useIntervalPolling(() => {
    if (!selectedCollectionId) return
    loadRedactionRuns(selectedCollectionId, selectedDraftRunIdRef.current)
  }, {
    enabled: Boolean(selectedCollectionId && activeDraftRuns > 0),
    intervalMs: 4000,
  })

  const handleGenerateDraft = async () => {
    const trimmedIdeas = userIdeas.trim()

    if (!selectedCollectionId || isSubmitting) return
    if (!trimmedIdeas) {
      setNotification('Escribe tus ideas, hipotesis o conclusiones antes de generar el borrador')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await redactionAPI.createRun(selectedCollectionId, {
        user_idea: trimmedIdeas,
        text_type: textType,
        synthesis_run_id: selectedSynthesisRunId || null,
        evidence_extraction_run_id: selectedEvidenceRunId || null,
        parent_run_id: null,
      })
      const createdRunId = response?.data?.run_id || null

      await loadRedactionRuns(selectedCollectionId, createdRunId)
      setNotification('Borrador encolado correctamente')
    } catch (error) {
      setNotification(error.message || 'Error al generar el borrador cientifico')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyDraft = async () => {
    const text = cleanAssistantText(selectedDraftText)
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setNotification('Borrador copiado al portapapeles')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setNotification('Borrador copiado al portapapeles')
    }
  }

  const handleOpenDraftPdf = () => {
    const sections = getDraftPdfSections(selectedDraftText)
    if (sections.length === 0) {
      setNotification('El borrador no tiene contenido suficiente para generar PDF')
      return
    }

    const blob = createPaperPdfBlob({
      title: getDraftTitle(selectedDraftRun),
      collectionName,
      sections,
    })
    openPdfBlob(blob)
  }

  const handleDownloadDraftPdf = () => {
    const sections = getDraftPdfSections(selectedDraftText)
    if (sections.length === 0) {
      setNotification('El borrador no tiene contenido suficiente para generar PDF')
      return
    }

    const blob = createPaperPdfBlob({
      title: getDraftTitle(selectedDraftRun),
      collectionName,
      sections,
    })
    downloadPdfBlob(blob, buildPdfFilename(collectionName, selectedDraftRun))
  }

  const handleRequestDraftRevision = async () => {
    const instruction = revisionInstruction.trim()

    if (!selectedCollectionId || !selectedDraftRun || isRequestingRevision) return
    if (!instruction) {
      setNotification('Escribe que quieres cambiar antes de pedir una revision')
      return
    }

    try {
      setIsRequestingRevision(true)
      const response = await redactionAPI.createRun(selectedCollectionId, {
        user_idea: instruction,
        text_type: textType,
        synthesis_run_id: selectedSynthesisRunId || null,
        evidence_extraction_run_id: selectedEvidenceRunId || null,
        parent_run_id: selectedDraftRun._id,
      })
      const createdRunId = response?.data?.run_id || null
      setRevisionInstruction('')
      setNotification('Revision con agente encolada correctamente')
      await loadRedactionRuns(selectedCollectionId, createdRunId)
    } catch (error) {
      setNotification(error.message || 'Error al pedir cambios al agente')
    } finally {
      setIsRequestingRevision(false)
    }
  }

  const pageClassName = embedded
    ? 'scientific-writing-page scientific-writing-embedded'
    : 'container scientific-writing-page'

  if (!selectedCollectionId) {
    return (
      <div className={pageClassName}>
        <section className="scientific-writing-empty">
          <i className="fas fa-pen-nib"></i>
          <h2>Selecciona una coleccion activa</h2>
          <p>
            La redaccion cientifica asistida necesita una coleccion para recuperar sintesis,
            evidencias y articulos disponibles.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className={pageClassName}>
      <section className="scientific-writing-hero">
        <div>
          <span className="scientific-writing-kicker">{embedded ? 'Etapa de redaccion' : 'Borrador revisable'}</span>
          <h1>Redaccion cientifica asistida</h1>
          <p>
            Formaliza ideas, hipotesis y conclusiones propias usando el contexto disponible
            de la coleccion activa.
          </p>
        </div>
        <div className="scientific-writing-collection-card">
          <span>Coleccion activa</span>
          <strong>{collectionName || 'Coleccion seleccionada'}</strong>
        </div>
      </section>

      <div className="scientific-writing-layout">
        <aside className="scientific-writing-panel scientific-writing-config">
          <div className="scientific-writing-panel-heading">
            <div>
              <span className="scientific-writing-kicker">Contexto</span>
              <h2>Material de apoyo</h2>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                loadSynthesisRuns(selectedCollectionId)
                loadRedactionRuns(selectedCollectionId, selectedDraftRunIdRef.current)
                loadEvidenceRuns(selectedCollectionId)
              }}
            >
              <i className="fas fa-rotate-right"></i>
              <span>{loadingSynthesisRuns || loadingRedactionRuns || loadingEvidenceRuns ? 'Actualizando...' : 'Actualizar'}</span>
            </button>
          </div>

          <label className="scientific-writing-field">
            <span>Sintesis previa opcional</span>
            <select
              value={selectedSynthesisRunId || ''}
              onChange={(event) => setSelectedSynthesisRunId(event.target.value || null)}
            >
              <option value="">Sin sintesis previa</option>
              {completedSynthesisRuns.map((run) => (
                <option key={run._id} value={run._id}>
                  {getSynthesisTitle(run)} · {formatTimestamp(run.created_at)}
                </option>
              ))}
            </select>
          </label>

          {selectedSynthesisRun ? (
            <div className="scientific-writing-context-preview">
              <strong>{getSynthesisTitle(selectedSynthesisRun)}</strong>
              <p>{truncateText(selectedSynthesisRun.response || selectedSynthesisRun.prompt, 260)}</p>
            </div>
          ) : null}

          <label className="scientific-writing-field">
            <span>Evidence extraction opcional</span>
            <select
              value={selectedEvidenceRunId || ''}
              onChange={(event) => setSelectedEvidenceRunId(event.target.value || null)}
            >
              <option value="">Sin evidence extraction</option>
              {completedEvidenceRuns.map((run) => (
                <option key={run._id} value={run._id}>
                  {formatEvidenceMode(run.selection_mode)} · {formatTimestamp(run.created_at)}
                </option>
              ))}
            </select>
          </label>

          {selectedEvidenceRunId ? (
            <div className="scientific-writing-context-preview">
              <strong>
                {loadingEvidenceResults
                  ? 'Cargando fichas...'
                  : `${evidenceResults.length} fichas de evidencia disponibles`}
              </strong>
              <p>
                {selectedEvidenceRun
                  ? `Modo: ${formatEvidenceMode(selectedEvidenceRun.selection_mode)}`
                  : 'Se usaran las fichas estructuradas que existan para este run.'}
              </p>
            </div>
          ) : null}

          <div className="scientific-writing-divider"></div>

          <div className="scientific-writing-type-section">
            <span className="scientific-writing-field-label">Tipo de texto</span>
            <div className="scientific-writing-type-grid">
              {TEXT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`scientific-writing-type-button ${textType === option.value ? 'active' : ''}`}
                  onClick={() => setTextType(option.value)}
                >
                  <i className={`fas ${option.icon}`}></i>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="scientific-writing-field">
            <span>Ideas, hipotesis o conclusiones</span>
            <textarea
              value={userIdeas}
              onChange={(event) => setUserIdeas(event.target.value)}
              placeholder="Ejemplo: Quiero relacionar la idea del articulo A sobre X con la evidencia de B sobre Y. Mi hipotesis es que Z y necesito formalizarlo como una seccion de discusion."
              rows={10}
            />
          </label>

          <div className="scientific-writing-submit-row">
            <p>El texto generado queda como borrador revisable y puede requerir validacion manual.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleGenerateDraft}
              disabled={isSubmitting || loadingEvidenceResults}
            >
              {isSubmitting ? <span className="spinner small"></span> : <i className="fas fa-wand-magic-sparkles"></i>}
              <span>{isSubmitting ? 'Generando...' : 'Generar borrador'}</span>
            </button>
          </div>
        </aside>

        <main className="scientific-writing-main">
          <section className="scientific-writing-panel scientific-writing-history">
            <div className="scientific-writing-panel-heading">
              <div>
                <span className="scientific-writing-kicker">Historial</span>
                <h2>Borradores generados</h2>
              </div>
              <span className="scientific-writing-count">{draftRuns.length}</span>
            </div>

            {loadingRedactionRuns && draftRuns.length === 0 ? (
              <div className="scientific-writing-mini-empty">
                <span className="spinner"></span>
                <p>Cargando borradores...</p>
              </div>
            ) : null}

            {!loadingRedactionRuns && draftRuns.length === 0 ? (
              <div className="scientific-writing-mini-empty">
                <i className="fas fa-file-circle-plus"></i>
                <p>No hay borradores cientificos todavia para esta coleccion.</p>
              </div>
            ) : null}

            {draftRuns.length > 0 ? (
              <div className="scientific-writing-draft-list">
                {draftRuns.map((run) => (
                  <button
                    key={run._id}
                    type="button"
                    className={`scientific-writing-draft-item ${selectedDraftRunId === run._id ? 'active' : ''}`}
                    onClick={() => setSelectedDraftRunId(run._id)}
                  >
                    <span className={`scientific-writing-status ${run.status || 'queued'}`}>{run.status || 'queued'}</span>
                    <strong>{getDraftTitle(run)}</strong>
                    <small>{formatTimestamp(run.created_at)}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="scientific-writing-panel scientific-writing-result">
            <div className="scientific-writing-result-heading">
              <div>
                <span className="scientific-writing-kicker">Resultado</span>
                <h2>{selectedDraftRun ? getDraftTitle(selectedDraftRun) : 'Borrador cientifico'}</h2>
              </div>
            </div>

            {!selectedDraftRun ? (
              <div className="scientific-writing-empty-result">
                <i className="fas fa-pen-nib"></i>
                <h3>Prepara tu borrador</h3>
                <p>
                  Escribe tu idea, selecciona el tipo de texto y anade contexto si ya tienes
                  una sintesis o fichas de evidencia.
                </p>
              </div>
            ) : null}

            {selectedDraftRun && isActiveRunStatus(selectedDraftRun.status) ? (
              <div className="scientific-writing-empty-result">
                <span className="spinner"></span>
                <h3>Borrador en procesamiento</h3>
                <p>La generacion esta en marcha. El resultado aparecera aqui al completarse.</p>
              </div>
            ) : null}

            {selectedDraftRun?.error_message ? (
              <div className="scientific-writing-error">{selectedDraftRun.error_message}</div>
            ) : null}

            {selectedDraftRun?.status === 'completed' && !selectedDraftText ? (
              <div className="scientific-writing-empty-result">
                <i className="fas fa-file-circle-question"></i>
                <p>Este run termino, pero no contiene texto de respuesta.</p>
              </div>
            ) : null}

            {selectedDraftText ? (
              <article className="scientific-writing-draft-readonly" aria-label="Borrador en solo lectura">
                {selectedDraftSections.length > 0 ? (
                  selectedDraftSections.map((section, index) => (
                    <section
                      key={`${selectedDraftRun._id}-section-${index}`}
                      className="scientific-writing-draft-section"
                    >
                      <h3>{section.heading}</h3>
                      {section.content.split('\n\n').map((paragraph, paragraphIndex) => (
                        <p key={`${selectedDraftRun._id}-section-${index}-p-${paragraphIndex}`}>
                          {paragraph}
                        </p>
                      ))}
                    </section>
                  ))
                ) : (
                  cleanAssistantText(selectedDraftText)
                    .split('\n\n')
                    .map((paragraph, paragraphIndex) => (
                      <p key={`${selectedDraftRun._id}-p-${paragraphIndex}`}>{paragraph}</p>
                    ))
                )}

                {selectedDraftReferences.length > 0 ? (
                  <section className="scientific-writing-draft-references">
                    <h3>Referencias citadas</h3>
                    <ul>
                      {selectedDraftReferences.map((reference, index) => (
                        <li key={`${selectedDraftRun._id}-ref-${index}`}>
                          <strong>{reference.cited_as || reference.article_title}</strong>
                          {reference.article_title && reference.cited_as
                            ? ` · ${reference.article_title}`
                            : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </article>
            ) : null}

            {selectedReviewPoints.length > 0 ? (
              <div className="scientific-writing-review-points">
                <h3>
                  <i className="fas fa-list-check"></i>
                  <span>Puntos a revisar</span>
                </h3>
                <ul>
                  {selectedReviewPoints.map((point, index) => (
                    <li key={`${selectedDraftRun._id}-review-${index}`}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selectedDraftText ? (
              <div className="scientific-writing-result-footer">
                <button type="button" className="btn-secondary" onClick={handleCopyDraft}>
                  <i className="fas fa-copy"></i>
                  <span>Copiar al portapapeles</span>
                </button>
                <button type="button" className="btn-secondary" onClick={handleOpenDraftPdf}>
                  <i className="fas fa-eye"></i>
                  <span>Ver PDF</span>
                </button>
                <button type="button" className="btn-primary" onClick={handleDownloadDraftPdf}>
                  <i className="fas fa-file-pdf"></i>
                  <span>Descargar PDF</span>
                </button>
              </div>
            ) : null}

            {selectedDraftRun?.status === 'completed' && selectedDraftText ? (
              <div className="scientific-writing-revision-panel">
                <span className="scientific-writing-kicker">Pedir revision</span>
                <h3>¿Que quieres cambiar?</h3>
                <textarea
                  value={revisionInstruction}
                  onChange={(event) => setRevisionInstruction(event.target.value)}
                  placeholder="Ejemplo: refuerza la discusion teorica, reduce repeticiones y aclara que las citas deben revisarse."
                  rows={6}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleRequestDraftRevision}
                  disabled={isRequestingRevision || !revisionInstruction.trim()}
                >
                  <i className={`fas ${isRequestingRevision ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                  <span>{isRequestingRevision ? 'Pidiendo revision...' : 'Pedir revision'}</span>
                </button>
                <p>
                  Se generara un nuevo borrador en el historial encadenado al actual mediante <code>parent_run_id</code>.
                </p>
              </div>
            ) : null}
          </section>
        </main>
      </div>

      <NotificationToast message={notification} onClose={() => setNotification('')} />
    </div>
  )
}

export default ScientificWriting
