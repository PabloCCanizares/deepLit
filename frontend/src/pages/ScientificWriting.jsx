import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { collectionSynthesisAPI, evidenceExtractionAPI } from '../api/index.js'
import NotificationToast from '../components/common/NotificationToast'
import { useCollection } from '../context/CollectionContext'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import { useIntervalPolling } from '../hooks/useIntervalPolling'
import { createPaperPdfBlob, downloadPdfBlob, openPdfBlob } from '../utils/pdfExport'

import '../styles/App.css'
import '../styles/workspace/ScientificWriting.css'

const DRAFT_MARKER = 'MODO: REDACCION CIENTIFICA ASISTIDA'

const TEXT_TYPE_OPTIONS = [
  { value: 'summary', label: 'Resumen', icon: 'fa-align-left' },
  { value: 'introduction', label: 'Introduccion', icon: 'fa-door-open' },
  { value: 'state_of_art', label: 'Estado de la cuestion', icon: 'fa-book-open' },
  { value: 'discussion', label: 'Discusion', icon: 'fa-comments' },
  { value: 'conclusions', label: 'Conclusiones', icon: 'fa-flag-checkered' },
  { value: 'full_draft', label: 'Borrador completo', icon: 'fa-file-lines' },
  { value: 'custom', label: 'Seccion personalizada', icon: 'fa-pen' },
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

function getTextBlocks(value) {
  return cleanAssistantText(value)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
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

function isScientificDraftRun(run) {
  return String(run?.prompt || '').includes(DRAFT_MARKER)
}

function getDraftTitle(run) {
  const firstLine = cleanAssistantText(run?.prompt).split('\n')[0]?.trim()
  if (firstLine?.toLowerCase().startsWith('borrador cientifico:')) {
    return firstLine.replace(/^borrador cientifico:\s*/i, 'Borrador: ')
  }
  return 'Borrador cientifico'
}

function getSynthesisTitle(run) {
  if (!run) return 'Sin sintesis'
  if (isScientificDraftRun(run)) return getDraftTitle(run)
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

function listToText(value, limit = 5) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? [value]
      : []

  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (!item || typeof item !== 'object') return ''
      return item.text || item.snippet || item.quote || item.content || ''
    })
    .filter(Boolean)
    .slice(0, limit)
    .join('; ')
}

function supportToText(value, limit = 3) {
  const items = Array.isArray(value) ? value : []
  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (!item || typeof item !== 'object') return ''
      const snippet = item.snippet || item.text || item.quote || item.content || ''
      const page = item.page ? `p. ${item.page}` : ''
      return [snippet, page].filter(Boolean).join(' ')
    })
    .filter(Boolean)
    .slice(0, limit)
    .join(' | ')
}

function formatEvidenceMode(value) {
  const labels = {
    all: 'Toda la coleccion',
    screening_include: 'Incluidos de screening',
    screening_include_review: 'Incluidos + revision',
  }
  return labels[value] || value || 'Sin modo'
}

function buildEvidenceContext(results) {
  if (!results.length) return 'No hay fichas de evidencia cargadas para este run.'

  return results.slice(0, 8).map((item, index) => {
    const lines = [
      `Articulo ${index + 1}: ${item.article_title || item.article_id || 'Articulo sin titulo'}`,
      item.objective ? `Objetivo: ${truncateText(item.objective, 420)}` : null,
      item.methodology ? `Metodologia: ${truncateText(item.methodology, 420)}` : null,
      item.dataset ? `Dataset: ${truncateText(item.dataset, 260)}` : null,
      listToText(item.variables, 6) ? `Variables: ${listToText(item.variables, 6)}` : null,
      listToText(item.metrics, 6) ? `Metricas: ${listToText(item.metrics, 6)}` : null,
      listToText(item.findings, 6) ? `Hallazgos: ${truncateText(listToText(item.findings, 6), 650)}` : null,
      listToText(item.limitations, 4) ? `Limitaciones: ${truncateText(listToText(item.limitations, 4), 420)}` : null,
      supportToText(item.findings_support, 3) ? `Soporte textual: ${truncateText(supportToText(item.findings_support, 3), 650)}` : null,
    ].filter(Boolean)

    return lines.join('\n')
  }).join('\n\n')
}

function buildDraftPrompt({
  sectionLabel,
  collectionName,
  userIdeas,
  synthesisRun,
  evidenceRun,
  evidenceResults,
}) {
  const synthesisContext = synthesisRun?.response
    ? [
        `Prompt original: ${truncateText(synthesisRun.prompt, 900)}`,
        `Respuesta de sintesis: ${truncateText(synthesisRun.response, 6000)}`,
      ].join('\n')
    : 'No seleccionada.'

  const evidenceContext = evidenceRun
    ? [
        `Run de evidence extraction: ${formatEvidenceMode(evidenceRun.selection_mode)} (${evidenceRun._id})`,
        buildEvidenceContext(evidenceResults),
      ].join('\n')
    : 'No seleccionada.'

  return [
    `Borrador cientifico: ${sectionLabel}`,
    '',
    DRAFT_MARKER,
    `Tipo de texto solicitado: ${sectionLabel}`,
    `Coleccion activa: ${collectionName || 'Coleccion seleccionada'}`,
    '',
    'IDEAS, HIPOTESIS, CONCLUSIONES O INDICACIONES DEL USUARIO:',
    userIdeas,
    '',
    'SINTESIS PREVIA SELECCIONADA:',
    synthesisContext,
    '',
    'EVIDENCIA EXTRAIDA SELECCIONADA:',
    evidenceContext,
    '',
    'INSTRUCCIONES OBLIGATORIAS:',
    '- Redacta en espanol con tono academico, claro y revisable.',
    '- El resultado es un borrador de trabajo, no una publicacion final.',
    '- Usa las ideas del usuario como eje argumental, pero diferencia lo que aporta el usuario de lo que esta apoyado por articulos.',
    '- No inventes citas, referencias, autores, anos, resultados ni detalles metodologicos.',
    '- Si una afirmacion no tiene soporte suficiente en la sintesis o en la evidencia, indicalo como punto a revisar.',
    '- Si mencionas literatura, usa solo titulos, identificadores o etiquetas disponibles en el contexto.',
    '- Ordena los argumentos y evita afirmaciones demasiado fuertes cuando el soporte sea limitado.',
    '- Devuelve exactamente estas secciones: APORTACION DEL USUARIO, EVIDENCIA UTILIZADA, BORRADOR, PUNTOS A REVISAR.',
  ].join('\n')
}

function buildTxtFilename(collectionName, run) {
  const base = `${collectionName || 'coleccion'}-${getDraftTitle(run)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'borrador-cientifico'}.txt`
}

function buildPdfFilename(collectionName, run) {
  const base = `${collectionName || 'coleccion'}-${getDraftTitle(run)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'borrador-cientifico'}.pdf`
}

function getDraftPdfSections(run) {
  const parsedSections = parseDraftSections(run?.response || '')
  if (parsedSections.length > 0) return parsedSections

  const text = cleanAssistantText(run?.response)
  return text ? [{ heading: 'BORRADOR', content: text }] : []
}

function ScientificWriting({ embedded = false }) {
  const { selectedCollectionId, collections } = useCollection()

  const [textType, setTextType] = useState('discussion')
  const [customSection, setCustomSection] = useState('')
  const [userIdeas, setUserIdeas] = useState('')

  const [synthesisRuns, setSynthesisRuns] = useState([])
  const [evidenceRuns, setEvidenceRuns] = useState([])
  const [evidenceResults, setEvidenceResults] = useState([])
  const [selectedSynthesisRunId, setSelectedSynthesisRunId] = useState(null)
  const [selectedEvidenceRunId, setSelectedEvidenceRunId] = useState(null)
  const [selectedEvidenceRun, setSelectedEvidenceRun] = useState(null)
  const [selectedDraftRunId, setSelectedDraftRunId] = useState(null)

  const [loadingSynthesisRuns, setLoadingSynthesisRuns] = useState(false)
  const [loadingEvidenceRuns, setLoadingEvidenceRuns] = useState(false)
  const [loadingEvidenceResults, setLoadingEvidenceResults] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState('')

  const activeCollectionIdRef = useRef(selectedCollectionId)
  const selectedDraftRunIdRef = useRef(selectedDraftRunId)
  const selectedSynthesisRunIdRef = useRef(selectedSynthesisRunId)
  const selectedEvidenceRunIdRef = useRef(selectedEvidenceRunId)
  const synthesisRequestIdRef = useRef(0)
  const evidenceRunsRequestIdRef = useRef(0)
  const evidenceResultsRequestIdRef = useRef(0)

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection._id === selectedCollectionId) || null,
    [collections, selectedCollectionId]
  )
  const collectionName = selectedCollection?.name || null

  const draftRuns = useMemo(
    () => sortRunsByDate(synthesisRuns.filter(isScientificDraftRun)),
    [synthesisRuns]
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
  const selectedSynthesisRun = useMemo(
    () => synthesisRuns.find((run) => run._id === selectedSynthesisRunId) || null,
    [synthesisRuns, selectedSynthesisRunId]
  )
  const selectedTextTypeOption = TEXT_TYPE_OPTIONS.find((option) => option.value === textType) || TEXT_TYPE_OPTIONS[0]
  const sectionLabel = textType === 'custom'
    ? customSection.trim() || 'Seccion personalizada'
    : selectedTextTypeOption.label
  const selectedDraftSections = useMemo(
    () => parseDraftSections(selectedDraftRun?.response || ''),
    [selectedDraftRun]
  )
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

  const loadSynthesisRuns = useCallback(async (collectionId, preferredDraftRunId = null, options = {}) => {
    const { preserveSelection = true } = options
    if (!collectionId) return

    const requestId = synthesisRequestIdRef.current + 1
    synthesisRequestIdRef.current = requestId

    try {
      setLoadingSynthesisRuns(true)
      const response = await collectionSynthesisAPI.listRuns(collectionId)
      if (activeCollectionIdRef.current !== collectionId || synthesisRequestIdRef.current !== requestId) return

      const nextRuns = response?.data?.runs || []
      const nextDraftRuns = sortRunsByDate(nextRuns.filter(isScientificDraftRun))
      setSynthesisRuns(nextRuns)

      setSelectedDraftRunId(resolveRunSelection(
        nextDraftRuns,
        preserveSelection ? selectedDraftRunIdRef.current : null,
        preferredDraftRunId
      ))

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
    evidenceRunsRequestIdRef.current += 1
    evidenceResultsRequestIdRef.current += 1

    setSynthesisRuns([])
    setEvidenceRuns([])
    setEvidenceResults([])
    setSelectedSynthesisRunId(null)
    setSelectedEvidenceRunId(null)
    setSelectedEvidenceRun(null)
    setSelectedDraftRunId(null)

    if (!selectedCollectionId) {
      setLoadingSynthesisRuns(false)
      setLoadingEvidenceRuns(false)
      setLoadingEvidenceResults(false)
      return
    }

    loadSynthesisRuns(selectedCollectionId, null, { preserveSelection: false })
    loadEvidenceRuns(selectedCollectionId, { preserveSelection: false })
  }, [loadEvidenceRuns, loadSynthesisRuns, selectedCollectionId])

  useEffect(() => {
    loadEvidenceResults(selectedEvidenceRunId)
  }, [loadEvidenceResults, selectedEvidenceRunId])

  useArticlesEvents({
    onCollectionSynthesisReady: async (data) => {
      if (data.collection_id !== activeCollectionIdRef.current) return
      setNotification('Generacion actualizada correctamente')
      await loadSynthesisRuns(data.collection_id, data.run_id)
    },
    onCollectionSynthesisError: async (data) => {
      if (data.collection_id !== activeCollectionIdRef.current) return
      setNotification(data.error_message || 'Error al generar el borrador')
      await loadSynthesisRuns(data.collection_id, data.run_id)
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
    loadSynthesisRuns(selectedCollectionId, selectedDraftRunIdRef.current)
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

    const prompt = buildDraftPrompt({
      sectionLabel,
      collectionName,
      userIdeas: trimmedIdeas,
      synthesisRun: selectedSynthesisRun,
      evidenceRun: selectedEvidenceRun,
      evidenceResults,
    })

    try {
      setIsSubmitting(true)
      const response = await collectionSynthesisAPI.runSynthesis(selectedCollectionId, prompt)
      const createdRun = response?.data?.run || null

      await loadSynthesisRuns(selectedCollectionId, createdRun?._id || null)
      setNotification('Borrador encolado correctamente')
    } catch (error) {
      setNotification(error.message || 'Error al generar el borrador cientifico')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyDraft = async () => {
    const text = cleanAssistantText(selectedDraftRun?.response)
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

  const handleDownloadDraft = () => {
    const text = cleanAssistantText(selectedDraftRun?.response)
    if (!text) return

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildTxtFilename(collectionName, selectedDraftRun)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleOpenDraftPdf = () => {
    const sections = getDraftPdfSections(selectedDraftRun)
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
    const sections = getDraftPdfSections(selectedDraftRun)
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
                loadEvidenceRuns(selectedCollectionId)
              }}
            >
              <i className="fas fa-rotate-right"></i>
              <span>{loadingSynthesisRuns || loadingEvidenceRuns ? 'Actualizando...' : 'Actualizar'}</span>
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

          {textType === 'custom' ? (
            <label className="scientific-writing-field">
              <span>Nombre de la seccion</span>
              <input
                type="text"
                value={customSection}
                onChange={(event) => setCustomSection(event.target.value)}
                placeholder="Ejemplo: Implicaciones teoricas"
              />
            </label>
          ) : null}

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

            {loadingSynthesisRuns && draftRuns.length === 0 ? (
              <div className="scientific-writing-mini-empty">
                <span className="spinner"></span>
                <p>Cargando borradores...</p>
              </div>
            ) : null}

            {!loadingSynthesisRuns && draftRuns.length === 0 ? (
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
              {selectedDraftRun?.response ? (
                <div className="scientific-writing-result-actions">
                  <button type="button" className="btn-secondary" onClick={handleCopyDraft}>
                    <i className="fas fa-copy"></i>
                    <span>Copiar</span>
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleDownloadDraft}>
                    <i className="fas fa-download"></i>
                    <span>TXT</span>
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

            {selectedDraftRun?.status === 'completed' && !selectedDraftRun.response ? (
              <div className="scientific-writing-empty-result">
                <i className="fas fa-file-circle-question"></i>
                <p>Este run termino, pero no contiene texto de respuesta.</p>
              </div>
            ) : null}

            {selectedDraftRun?.response ? (
              <div className="scientific-writing-draft-content">
                {selectedDraftSections.length > 0
                  ? selectedDraftSections.map((section) => (
                      <article key={`${selectedDraftRun._id}-${section.heading}`} className="scientific-writing-section">
                        <h3>{section.heading}</h3>
                        {getTextBlocks(section.content).map((block, index) => (
                          <p key={`${selectedDraftRun._id}-${section.heading}-${index}`}>{block}</p>
                        ))}
                      </article>
                    ))
                  : getTextBlocks(selectedDraftRun.response).map((block, index) => (
                      <p key={`${selectedDraftRun._id}-block-${index}`}>{block}</p>
                    ))}
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
