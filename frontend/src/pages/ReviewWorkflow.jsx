import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  clusteringAPI,
  collectionSynthesisAPI,
  collectionsAPI,
  evidenceExtractionAPI,
  redactionAPI,
  screeningAPI,
} from '../api/index.js'
import EmptyStepState from '../components/reviewWorkflow/EmptyStepState'
import RunStatusBadge from '../components/reviewWorkflow/RunStatusBadge'
import WorkflowStepSidebar from '../components/reviewWorkflow/WorkflowStepSidebar'
import { FieldBlock, ListBlock, SupportBlock } from '../components/reviewWorkflow/EvidenceFieldBlocks'
import NotificationToast from '../components/common/NotificationToast'
import { useCollection } from '../context/CollectionContext'
import { useArticlesEvents } from '../hooks/useArticlesEvents'
import ScientificWriting from './ScientificWriting'

import '../styles/App.css'
import '../styles/workspace/EvidenceExtraction.css'
import '../styles/workspace/Clustering.css'
import '../styles/workspace/CollectionSynthesis.css'
import '../styles/workspace/ReviewWorkflow.css'

const STEP_IDS = ['preparation', 'screening', 'evidence', 'clustering', 'synthesis', 'writing']

const STEP_DEFINITIONS = {
  preparation: {
    title: 'Preparacion',
    subtitle: 'Coleccion y material disponible',
    icon: 'fa-folder-open',
  },
  screening: {
    title: 'Cribado',
    subtitle: 'Cribado por pregunta y criterios',
    icon: 'fa-filter',
  },
  evidence: {
    title: 'Extraccion de evidencia',
    subtitle: 'Fichas estructuradas por articulo',
    icon: 'fa-microscope',
  },
  clustering: {
    title: 'Clustering',
    subtitle: 'Agrupacion tematica opcional',
    icon: 'fa-object-group',
    optional: true,
  },
  synthesis: {
    title: 'Sintesis',
    subtitle: 'Respuesta integrada de coleccion',
    icon: 'fa-diagram-project',
  },
  writing: {
    title: 'Redaccion cientifica',
    subtitle: 'Formalizacion de ideas y conclusiones',
    icon: 'fa-pen-nib',
  },
}

const DECISION_LABELS = {
  all: 'Todos',
  include: 'Incluidos',
  review: 'Revision',
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

const SELECTION_MODE_OPTIONS = [
  {
    value: 'all',
    title: 'Toda la coleccion',
    description: 'Extrae fichas para todos los articulos elegibles de la coleccion activa.',
    icon: 'fa-layer-group',
  },
  {
    value: 'screening_include',
    title: 'Solo incluidos',
    description: 'Usa un cribado previo y trabaja con articulos marcados como include.',
    icon: 'fa-check-double',
  },
  {
    value: 'screening_include_review',
    title: 'Incluidos + revision',
    description: 'Incluye articulos prometedores pendientes de decision manual.',
    icon: 'fa-magnifying-glass-chart',
  },
]

const CLUSTER_MODE_OPTIONS = [
  {
    value: 'auto',
    title: 'Seleccion automatica',
    description: 'El sistema prueba varios agrupamientos y elige el mas coherente.',
    icon: 'fa-wand-magic-sparkles',
  },
  {
    value: 'manual',
    title: 'Numero fijo de clusters',
    description: 'Define cuantos grupos quieres intentar construir.',
    icon: 'fa-sliders',
  },
]

const SELECTION_MODE_LABELS = {
  all: 'Toda la coleccion',
  screening_include: 'Incluidos de cribado',
  screening_include_review: 'Incluidos + revision',
}

const SOURCE_TYPE_LABELS = {
  full_text: 'Texto completo',
  metadata: 'Metadatos',
}

const CONTEXT_SOURCE_LABELS = {
  full_text: 'Texto completo',
  metadata: 'Metadatos',
  mixed: 'Mixto',
  unavailable: 'No disponible',
}

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

function formatConfidence(confidence) {
  if (typeof confidence !== 'number') return 'N/D'
  return `${Math.round(confidence * 100)}%`
}

function formatDecision(decision) {
  return DECISION_DISPLAY_LABELS[decision] || decision
}

function formatSelectionMode(value) {
  return SELECTION_MODE_LABELS[value] || value || 'Toda la coleccion'
}

function formatSourceType(value) {
  return SOURCE_TYPE_LABELS[value] || value || 'Sin fuente'
}

function formatContextSource(value) {
  return CONTEXT_SOURCE_LABELS[value] || value || 'No disponible'
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
  if (!articleId) return 'Articulo sin titulo'

  const withoutPrefix = String(articleId).replace(/^article_/, '')
  const withoutTimestamp = withoutPrefix.replace(/_\d{14}$/, '')
  const normalized = withoutTimestamp.replace(/[_-]+/g, ' ').trim()

  return normalized || String(articleId)
}

function parseCriteria(rawValue) {
  return rawValue
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function trimText(value, maxLength = 220) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength).split(' ').slice(0, -1).join(' ').trim()
  return `${truncated || text.slice(0, maxLength)}...`
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

function resolveRunSelection(runs, preferredRunId, fallbackRunId) {
  if (preferredRunId && runs.some((run) => run._id === preferredRunId)) {
    return preferredRunId
  }

  if (fallbackRunId && runs.some((run) => run._id === fallbackRunId)) {
    return fallbackRunId
  }

  return runs[0]?._id || null
}

function getStepState(runs, { blocked = false, optional = false } = {}) {
  if (blocked) return 'blocked'
  if (runs.some((run) => isActiveRunStatus(run.status))) return 'processing'
  if (runs.some((run) => run.status === 'completed')) return 'completed'
  return optional ? 'optional' : 'available'
}

function hasProcessedPdf(article) {
  if (!article) return false
  if (article.status === 'processing' || article.status === 'error') return false
  return Boolean(article.id_pdf || article.source === 'pdf')
}

function getSearchStep(searchParams) {
  const requestedStep = searchParams.get('step')
  return STEP_IDS.includes(requestedStep) ? requestedStep : 'preparation'
}

function FieldPillList({ items }) {
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => String(item || '').trim()).filter(Boolean)
    : []

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

function ReviewWorkflow() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedCollectionId, collections } = useCollection()
  const requestedStep = getSearchStep(searchParams)

  const [activeStep, setActiveStep] = useState(requestedStep)
  const [notification, setNotification] = useState('')

  const [collectionSummary, setCollectionSummary] = useState({
    totalArticles: 0,
    pdfArticles: 0,
    metadataArticles: 0,
    pendingArticles: 0,
    failedArticles: 0,
  })
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  const [screeningRuns, setScreeningRuns] = useState([])
  const [selectedScreeningRunId, setSelectedScreeningRunId] = useState(null)
  const [selectedScreeningRun, setSelectedScreeningRun] = useState(null)
  const [screeningResults, setScreeningResults] = useState([])
  const [screeningDecisionFilter, setScreeningDecisionFilter] = useState('all')
  const [loadingScreeningRuns, setLoadingScreeningRuns] = useState(false)
  const [loadingScreeningResults, setLoadingScreeningResults] = useState(false)
  const [screeningRunsError, setScreeningRunsError] = useState(null)
  const [screeningResultsError, setScreeningResultsError] = useState(null)
  const [creatingScreening, setCreatingScreening] = useState(false)
  const [updatingScreeningArticleId, setUpdatingScreeningArticleId] = useState(null)
  const [screeningForm, setScreeningForm] = useState({
    researchQuestion: '',
    inclusionCriteria: '',
    exclusionCriteria: '',
  })

  const [evidenceRuns, setEvidenceRuns] = useState([])
  const [selectedEvidenceRunId, setSelectedEvidenceRunId] = useState(null)
  const [selectedEvidenceRun, setSelectedEvidenceRun] = useState(null)
  const [evidenceResults, setEvidenceResults] = useState([])
  const [loadingEvidenceRuns, setLoadingEvidenceRuns] = useState(false)
  const [loadingEvidenceResults, setLoadingEvidenceResults] = useState(false)
  const [evidenceRunsError, setEvidenceRunsError] = useState(null)
  const [evidenceResultsError, setEvidenceResultsError] = useState(null)
  const [creatingEvidence, setCreatingEvidence] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState({
    selectionMode: 'all',
    screeningRunId: '',
  })

  const [clusteringRuns, setClusteringRuns] = useState([])
  const [selectedClusteringRunId, setSelectedClusteringRunId] = useState(null)
  const [selectedClusteringRun, setSelectedClusteringRun] = useState(null)
  const [clusteringResults, setClusteringResults] = useState([])
  const [loadingClusteringRuns, setLoadingClusteringRuns] = useState(false)
  const [loadingClusteringResults, setLoadingClusteringResults] = useState(false)
  const [clusteringRunsError, setClusteringRunsError] = useState(null)
  const [clusteringResultsError, setClusteringResultsError] = useState(null)
  const [creatingClustering, setCreatingClustering] = useState(false)
  const [clusteringForm, setClusteringForm] = useState({
    evidenceRunId: '',
    clusterMode: 'auto',
    clusterCount: 3,
  })

  const [synthesisRuns, setSynthesisRuns] = useState([])
  const [selectedSynthesisRunId, setSelectedSynthesisRunId] = useState(null)
  const [loadingSynthesisRuns, setLoadingSynthesisRuns] = useState(false)
  const [synthesisRunsError, setSynthesisRunsError] = useState(null)
  const [creatingSynthesis, setCreatingSynthesis] = useState(false)
  const [synthesisPrompt, setSynthesisPrompt] = useState('')

  const [redactionRuns, setRedactionRuns] = useState([])
  const [loadingRedactionRuns, setLoadingRedactionRuns] = useState(false)
  const [redactionRunsError, setRedactionRunsError] = useState(null)

  const selectedCollection = collections.find((collection) => collection._id === selectedCollectionId)
  const collectionName = selectedCollection?.name || null

  useEffect(() => {
    setActiveStep(requestedStep)
  }, [requestedStep])

  useEffect(() => {
    if (!notification) return undefined
    const timer = setTimeout(() => setNotification(''), 4000)
    return () => clearTimeout(timer)
  }, [notification])

  const changeStep = useCallback((stepId) => {
    setActiveStep(stepId)
    setSearchParams(stepId === 'preparation' ? {} : { step: stepId })
  }, [setSearchParams])

  const loadCollectionSummary = useCallback(async () => {
    if (!selectedCollectionId) return

    try {
      setLoadingSummary(true)
      setSummaryError(null)
      const response = await collectionsAPI.getWithArticles(selectedCollectionId, { limit: 500 })
      const data = response?.data || {}
      const articles = data.articles || []
      const totalArticles = data.article_count ?? selectedCollection?.article_count ?? articles.length
      const pendingArticles = articles.filter((article) => article.status === 'processing').length
      const failedArticles = articles.filter((article) => article.status === 'error').length
      const pdfArticles = articles.filter(hasProcessedPdf).length
      const metadataArticles = Math.max(0, totalArticles - pdfArticles - pendingArticles - failedArticles)

      setCollectionSummary({
        totalArticles,
        pdfArticles,
        metadataArticles,
        pendingArticles,
        failedArticles,
      })
    } catch (error) {
      setSummaryError(error.message || 'Error al cargar la coleccion activa')
    } finally {
      setLoadingSummary(false)
    }
  }, [selectedCollection?.article_count, selectedCollectionId])

  const loadScreeningRuns = useCallback(async ({ preserveSelection = true, preferredRunId = null } = {}) => {
    if (!selectedCollectionId) return

    try {
      setLoadingScreeningRuns(true)
      setScreeningRunsError(null)
      const response = await screeningAPI.listRuns(selectedCollectionId)
      const nextRuns = response?.data?.runs || []

      setScreeningRuns(nextRuns)
      setSelectedScreeningRunId((previousRunId) =>
        resolveRunSelection(nextRuns, preferredRunId, preserveSelection ? previousRunId : null)
      )
    } catch (error) {
      setScreeningRunsError(error.message || 'Error al cargar screenings')
    } finally {
      setLoadingScreeningRuns(false)
    }
  }, [selectedCollectionId])

  const loadScreeningResults = useCallback(async (runId) => {
    if (!runId) return

    try {
      setLoadingScreeningResults(true)
      setScreeningResultsError(null)
      const response = await screeningAPI.getRunResults(runId)
      setSelectedScreeningRun(response?.data?.run || null)
      setScreeningResults(response?.data?.results || [])
    } catch (error) {
      setScreeningResultsError(error.message || 'Error al cargar resultados del screening')
    } finally {
      setLoadingScreeningResults(false)
    }
  }, [])

  const loadEvidenceRuns = useCallback(async ({ preserveSelection = true, preferredRunId = null } = {}) => {
    if (!selectedCollectionId) return

    try {
      setLoadingEvidenceRuns(true)
      setEvidenceRunsError(null)
      const response = await evidenceExtractionAPI.listRuns(selectedCollectionId)
      const nextRuns = response?.data?.runs || []

      setEvidenceRuns(nextRuns)
      setSelectedEvidenceRunId((previousRunId) =>
        resolveRunSelection(nextRuns, preferredRunId, preserveSelection ? previousRunId : null)
      )
    } catch (error) {
      setEvidenceRunsError(error.message || 'Error al cargar extracciones de evidencia')
    } finally {
      setLoadingEvidenceRuns(false)
    }
  }, [selectedCollectionId])

  const loadEvidenceResults = useCallback(async (runId) => {
    if (!runId) return

    try {
      setLoadingEvidenceResults(true)
      setEvidenceResultsError(null)
      const response = await evidenceExtractionAPI.getRunResults(runId)
      setSelectedEvidenceRun(response?.data?.run || null)
      setEvidenceResults(response?.data?.results || [])
    } catch (error) {
      setEvidenceResultsError(error.message || 'Error al cargar fichas de evidencia')
    } finally {
      setLoadingEvidenceResults(false)
    }
  }, [])

  const loadClusteringRuns = useCallback(async ({ preserveSelection = true, preferredRunId = null } = {}) => {
    if (!selectedCollectionId) return

    try {
      setLoadingClusteringRuns(true)
      setClusteringRunsError(null)
      const response = await clusteringAPI.listRuns(selectedCollectionId)
      const nextRuns = response?.data?.runs || []

      setClusteringRuns(nextRuns)
      setSelectedClusteringRunId((previousRunId) =>
        resolveRunSelection(nextRuns, preferredRunId, preserveSelection ? previousRunId : null)
      )
    } catch (error) {
      setClusteringRunsError(error.message || 'Error al cargar clusterings')
    } finally {
      setLoadingClusteringRuns(false)
    }
  }, [selectedCollectionId])

  const loadClusteringResults = useCallback(async (runId) => {
    if (!runId) return

    try {
      setLoadingClusteringResults(true)
      setClusteringResultsError(null)
      const response = await clusteringAPI.getRunResults(runId)
      setSelectedClusteringRun(response?.data?.run || null)
      setClusteringResults(response?.data?.results || [])
    } catch (error) {
      setClusteringResultsError(error.message || 'Error al cargar resultados de clustering')
    } finally {
      setLoadingClusteringResults(false)
    }
  }, [])

  const loadSynthesisRuns = useCallback(async ({ preserveSelection = true, preferredRunId = null } = {}) => {
    if (!selectedCollectionId) return

    try {
      setLoadingSynthesisRuns(true)
      setSynthesisRunsError(null)
      const response = await collectionSynthesisAPI.listRuns(selectedCollectionId)
      const nextRuns = response?.data?.runs || []

      setSynthesisRuns(nextRuns)
      setSelectedSynthesisRunId((previousRunId) =>
        resolveRunSelection(nextRuns, preferredRunId, preserveSelection ? previousRunId : null)
      )
    } catch (error) {
      setSynthesisRunsError(error.message || 'Error al cargar sintesis guardadas')
    } finally {
      setLoadingSynthesisRuns(false)
    }
  }, [selectedCollectionId])

  const loadRedactionRuns = useCallback(async () => {
    if (!selectedCollectionId) return

    try {
      setLoadingRedactionRuns(true)
      setRedactionRunsError(null)
      const response = await redactionAPI.listRuns(selectedCollectionId)
      setRedactionRuns(response?.data?.runs || [])
    } catch (error) {
      setRedactionRunsError(error.message || 'Error al cargar borradores')
    } finally {
      setLoadingRedactionRuns(false)
    }
  }, [selectedCollectionId])

  useEffect(() => {
    setCollectionSummary({
      totalArticles: selectedCollection?.article_count || 0,
      pdfArticles: 0,
      metadataArticles: selectedCollection?.article_count || 0,
      pendingArticles: 0,
      failedArticles: 0,
    })
    setSummaryError(null)
    setScreeningRuns([])
    setSelectedScreeningRunId(null)
    setSelectedScreeningRun(null)
    setScreeningResults([])
    setEvidenceRuns([])
    setSelectedEvidenceRunId(null)
    setSelectedEvidenceRun(null)
    setEvidenceResults([])
    setClusteringRuns([])
    setSelectedClusteringRunId(null)
    setSelectedClusteringRun(null)
    setClusteringResults([])
    setSynthesisRuns([])
    setSelectedSynthesisRunId(null)
    setRedactionRuns([])

    if (!selectedCollectionId) return

    loadCollectionSummary()
    loadScreeningRuns({ preserveSelection: false })
    loadEvidenceRuns({ preserveSelection: false })
    loadClusteringRuns({ preserveSelection: false })
    loadSynthesisRuns({ preserveSelection: false })
    loadRedactionRuns()
  }, [
    loadClusteringRuns,
    loadCollectionSummary,
    loadEvidenceRuns,
    loadRedactionRuns,
    loadScreeningRuns,
    loadSynthesisRuns,
    selectedCollection?.article_count,
    selectedCollectionId,
  ])

  useEffect(() => {
    if (!selectedScreeningRunId) {
      setSelectedScreeningRun(null)
      setScreeningResults([])
      return
    }

    loadScreeningResults(selectedScreeningRunId)
  }, [loadScreeningResults, selectedScreeningRunId])

  useEffect(() => {
    if (!selectedEvidenceRunId) {
      setSelectedEvidenceRun(null)
      setEvidenceResults([])
      return
    }

    loadEvidenceResults(selectedEvidenceRunId)
  }, [loadEvidenceResults, selectedEvidenceRunId])

  useEffect(() => {
    if (!selectedClusteringRunId) {
      setSelectedClusteringRun(null)
      setClusteringResults([])
      return
    }

    loadClusteringResults(selectedClusteringRunId)
  }, [loadClusteringResults, selectedClusteringRunId])

  const completedScreeningRuns = useMemo(
    () => screeningRuns.filter((run) => run.status === 'completed'),
    [screeningRuns]
  )

  const completedEvidenceRuns = useMemo(
    () => evidenceRuns.filter((run) => run.status === 'completed'),
    [evidenceRuns]
  )

  const collectionSynthesisRuns = synthesisRuns

  const scientificDraftRuns = redactionRuns

  const selectedSynthesisRun = useMemo(
    () => collectionSynthesisRuns.find((run) => run._id === selectedSynthesisRunId) || null,
    [collectionSynthesisRuns, selectedSynthesisRunId]
  )

  const screeningRunMap = useMemo(
    () => new Map(screeningRuns.map((run) => [run._id, run])),
    [screeningRuns]
  )

  const evidenceRunMap = useMemo(
    () => new Map(evidenceRuns.map((run) => [run._id, run])),
    [evidenceRuns]
  )

  useEffect(() => {
    if (evidenceForm.selectionMode === 'all') return

    const currentStillExists = completedScreeningRuns.some((run) => run._id === evidenceForm.screeningRunId)
    if (currentStillExists) return

    setEvidenceForm((previous) => ({
      ...previous,
      screeningRunId: completedScreeningRuns[0]?._id || '',
    }))
  }, [completedScreeningRuns, evidenceForm.screeningRunId, evidenceForm.selectionMode])

  useEffect(() => {
    const currentStillExists = completedEvidenceRuns.some((run) => run._id === clusteringForm.evidenceRunId)
    if (currentStillExists) return

    setClusteringForm((previous) => ({
      ...previous,
      evidenceRunId: completedEvidenceRuns[0]?._id || '',
    }))
  }, [clusteringForm.evidenceRunId, completedEvidenceRuns])

  const activeRuns = useMemo(() => {
    return [
      ...screeningRuns,
      ...evidenceRuns,
      ...clusteringRuns,
      ...synthesisRuns,
      ...redactionRuns,
    ].filter((run) => isActiveRunStatus(run.status)).length
  }, [clusteringRuns, evidenceRuns, redactionRuns, screeningRuns, synthesisRuns])

  const completedSteps = useMemo(() => {
    return [
      screeningRuns,
      evidenceRuns,
      clusteringRuns,
      collectionSynthesisRuns,
      scientificDraftRuns,
    ].filter((runs) => runs.some((run) => run.status === 'completed')).length
  }, [clusteringRuns, collectionSynthesisRuns, evidenceRuns, scientificDraftRuns, screeningRuns])

  const steps = useMemo(() => {
    const hasCompletedEvidence = completedEvidenceRuns.length > 0

    return STEP_IDS.map((id) => {
      const definition = STEP_DEFINITIONS[id]
      const stateByStep = {
        preparation: collectionSummary.totalArticles > 0 ? 'completed' : 'available',
        screening: getStepState(screeningRuns),
        evidence: getStepState(evidenceRuns),
        clustering: getStepState(clusteringRuns, {
          blocked: !hasCompletedEvidence && clusteringRuns.length === 0,
          optional: true,
        }),
        synthesis: getStepState(collectionSynthesisRuns),
        writing: getStepState(scientificDraftRuns),
      }

      return {
        id,
        ...definition,
        state: stateByStep[id],
      }
    })
  }, [
    clusteringRuns,
    collectionSynthesisRuns,
    collectionSummary.totalArticles,
    completedEvidenceRuns.length,
    evidenceRuns,
    scientificDraftRuns,
    screeningRuns,
  ])

  const filteredScreeningResults = useMemo(() => {
    const baseResults = screeningDecisionFilter === 'all'
      ? screeningResults
      : screeningResults.filter((item) => item.decision === screeningDecisionFilter)

    return [...baseResults].sort((a, b) => {
      const aOrder = DECISION_ORDER[a.decision] ?? 99
      const bOrder = DECISION_ORDER[b.decision] ?? 99
      if (aOrder !== bOrder) return aOrder - bOrder
      return String(a.article_title || '').localeCompare(String(b.article_title || ''))
    })
  }, [screeningDecisionFilter, screeningResults])

  const groupedClusters = useMemo(() => {
    if (!selectedClusteringRun?.clusters) return []

    const assignmentsByCluster = new Map()
    for (const item of clusteringResults) {
      const currentItems = assignmentsByCluster.get(item.cluster_id) || []
      currentItems.push(item)
      assignmentsByCluster.set(item.cluster_id, currentItems)
    }

    return (selectedClusteringRun.clusters || []).map((cluster) => ({
      ...cluster,
      items: assignmentsByCluster.get(cluster.cluster_id) || [],
    }))
  }, [clusteringResults, selectedClusteringRun])

  useArticlesEvents({
    onScreeningReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Cribado completado correctamente')
      await loadScreeningRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) await loadScreeningResults(data.run_id)
    },
    onScreeningError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(`Error en cribado: ${data.error_message || 'Error desconocido'}`)
      await loadScreeningRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) await loadScreeningResults(data.run_id)
    },
    onEvidenceExtractionReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Extraccion de evidencia completada')
      await loadEvidenceRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) await loadEvidenceResults(data.run_id)
    },
    onEvidenceExtractionError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(`Error en extraccion: ${data.error_message || 'Error desconocido'}`)
      await loadEvidenceRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) await loadEvidenceResults(data.run_id)
    },
    onClusteringReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Clustering completado correctamente')
      await loadClusteringRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) await loadClusteringResults(data.run_id)
    },
    onClusteringError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(`Error en clustering: ${data.error_message || 'Error desconocido'}`)
      await loadClusteringRuns({ preserveSelection: true, preferredRunId: data.run_id })
      if (data.run_id) await loadClusteringResults(data.run_id)
    },
    onCollectionSynthesisReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Sintesis completada correctamente')
      await loadSynthesisRuns({ preserveSelection: true, preferredRunId: data.run_id })
    },
    onCollectionSynthesisError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(data.error_message || 'Error al generar la sintesis')
      await loadSynthesisRuns({ preserveSelection: true, preferredRunId: data.run_id })
    },
    onRedactionReady: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification('Borrador cientifico completado')
      await loadRedactionRuns()
    },
    onRedactionError: async (data) => {
      if (data.collection_id !== selectedCollectionId) return
      setNotification(data.error_message || 'Error al generar el borrador')
      await loadRedactionRuns()
    },
  }, Boolean(selectedCollectionId))

  const refreshAll = () => {
    loadCollectionSummary()
    loadScreeningRuns({ preserveSelection: true })
    loadEvidenceRuns({ preserveSelection: true })
    loadClusteringRuns({ preserveSelection: true })
    loadSynthesisRuns({ preserveSelection: true })
    loadRedactionRuns()
    if (selectedScreeningRunId) loadScreeningResults(selectedScreeningRunId)
    if (selectedEvidenceRunId) loadEvidenceResults(selectedEvidenceRunId)
    if (selectedClusteringRunId) loadClusteringResults(selectedClusteringRunId)
  }

  const handleCreateScreening = async () => {
    const researchQuestion = screeningForm.researchQuestion.trim()
    if (!selectedCollectionId || !researchQuestion || creatingScreening) return

    try {
      setCreatingScreening(true)
      const response = await screeningAPI.runCollection(selectedCollectionId, {
        research_question: researchQuestion,
        inclusion_criteria: parseCriteria(screeningForm.inclusionCriteria),
        exclusion_criteria: parseCriteria(screeningForm.exclusionCriteria),
      })
      const runId = response?.data?.run_id

      setScreeningForm({
        researchQuestion: '',
        inclusionCriteria: '',
        exclusionCriteria: '',
      })
      setNotification('Cribado encolado correctamente')
      await loadScreeningRuns({ preserveSelection: true, preferredRunId: runId })
      if (runId) await loadScreeningResults(runId)
    } catch (error) {
      setNotification(error.message || 'Error al lanzar el cribado')
    } finally {
      setCreatingScreening(false)
    }
  }

  const handleMoveReviewResult = async (item, nextDecision) => {
    if (!selectedScreeningRunId || !item?.article_id || updatingScreeningArticleId) return

    try {
      setUpdatingScreeningArticleId(item.article_id)
      const response = await screeningAPI.updateRunResult(selectedScreeningRunId, item.article_id, {
        decision: nextDecision,
        reason:
          nextDecision === 'include'
            ? 'Decision ajustada manualmente a incluido desde el flujo de revision.'
            : 'Decision ajustada manualmente a excluido desde el flujo de revision.',
      })

      const updatedRun = response?.data?.run || null
      const updatedResult = response?.data?.result || null

      if (updatedRun) {
        setSelectedScreeningRun(updatedRun)
        setScreeningRuns((previousRuns) =>
          previousRuns.map((run) => (run._id === updatedRun._id ? updatedRun : run))
        )
      }

      if (updatedResult) {
        setScreeningResults((previousResults) =>
          previousResults.map((currentItem) =>
            currentItem.article_id === item.article_id ? updatedResult : currentItem
          )
        )
      } else {
        await loadScreeningResults(selectedScreeningRunId)
      }

      setNotification(nextDecision === 'include' ? 'Articulo movido a incluidos' : 'Articulo movido a excluidos')
    } catch (error) {
      setNotification(error.message || 'Error al actualizar la decision')
    } finally {
      setUpdatingScreeningArticleId(null)
    }
  }

  const handleCreateEvidence = async () => {
    if (!selectedCollectionId || creatingEvidence) return

    if (evidenceForm.selectionMode !== 'all' && !evidenceForm.screeningRunId) {
      setNotification('Selecciona un cribado completado para este modo')
      return
    }

    try {
      setCreatingEvidence(true)
      const response = await evidenceExtractionAPI.runCollection(selectedCollectionId, {
        selection_mode: evidenceForm.selectionMode,
        screening_run_id: evidenceForm.selectionMode === 'all' ? null : evidenceForm.screeningRunId,
      })
      const runId = response?.data?.run_id

      setNotification('Extraccion de evidencia encolada correctamente')
      await loadEvidenceRuns({ preserveSelection: true, preferredRunId: runId })
      if (runId) await loadEvidenceResults(runId)
    } catch (error) {
      setNotification(error.message || 'Error al lanzar la extraccion')
    } finally {
      setCreatingEvidence(false)
    }
  }

  const handleCreateClustering = async () => {
    if (!selectedCollectionId || creatingClustering || !clusteringForm.evidenceRunId) return

    try {
      setCreatingClustering(true)
      const response = await clusteringAPI.runCollection(selectedCollectionId, {
        evidence_extraction_run_id: clusteringForm.evidenceRunId,
        cluster_count:
          clusteringForm.clusterMode === 'manual'
            ? Number(clusteringForm.clusterCount) || null
            : null,
      })
      const runId = response?.data?.run_id

      setNotification('Clustering encolado correctamente')
      await loadClusteringRuns({ preserveSelection: true, preferredRunId: runId })
      if (runId) await loadClusteringResults(runId)
    } catch (error) {
      setNotification(error.message || 'Error al lanzar el clustering')
    } finally {
      setCreatingClustering(false)
    }
  }

  const handleCreateSynthesis = async () => {
    const prompt = synthesisPrompt.trim()
    if (!selectedCollectionId || !prompt || creatingSynthesis) return

    try {
      setCreatingSynthesis(true)
      const response = await collectionSynthesisAPI.runSynthesis(selectedCollectionId, prompt)
      const runId = response?.data?.run?._id || response?.data?.run_id || null

      setSynthesisPrompt('')
      setNotification('Sintesis encolada correctamente')
      await loadSynthesisRuns({ preserveSelection: true, preferredRunId: runId })
    } catch (error) {
      setNotification(error.message || 'Error al generar la sintesis')
    } finally {
      setCreatingSynthesis(false)
    }
  }

  const handleOpenArticle = (articleId, from, runId) => {
    if (!articleId) return

    navigate(`/articles/${encodeURIComponent(articleId)}`, {
      state: {
        from,
        collectionId: selectedCollectionId,
        runId,
      },
    })
  }

  const renderPreparationStep = () => (
    <section className="workflow-step-panel">
      <div className="workflow-step-header">
        <div>
          <span className="workflow-kicker">Preparacion</span>
          <h2>Contexto de la coleccion activa</h2>
          <p>Esta pantalla mantiene una sola coleccion como hilo conductor del analisis.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={refreshAll}>
          <i className="fas fa-rotate-right"></i>
          <span>Actualizar todo</span>
        </button>
      </div>

      {summaryError ? <div className="workflow-error">{summaryError}</div> : null}

      <div className="workflow-preparation-grid">
        <article className="workflow-preparation-card">
          <i className="fas fa-file-lines"></i>
          <strong>{collectionSummary.totalArticles}</strong>
          <span>Articulos en la coleccion</span>
        </article>
        <article className="workflow-preparation-card">
          <i className="fas fa-file-pdf"></i>
          <strong>{collectionSummary.pdfArticles}</strong>
          <span>Con PDF procesado</span>
        </article>
        <article className="workflow-preparation-card">
          <i className="fas fa-tags"></i>
          <strong>{collectionSummary.metadataArticles}</strong>
          <span>Solo metadatos</span>
        </article>
        <article className="workflow-preparation-card">
          <i className="fas fa-hourglass-half"></i>
          <strong>{collectionSummary.pendingArticles}</strong>
          <span>PDFs pendientes</span>
        </article>
      </div>

      <div className="workflow-guidance-card">
        <h3>Orden recomendado</h3>
        <p>
          El flujo sugerido es realizar cribado, extraer evidencia sobre los articulos relevantes,
          agruparlos opcionalmente, sintetizar la coleccion y, si procede, redactar a partir de las
          sintesis y evidencias generadas.
        </p>
      </div>
    </section>
  )

  const renderScreeningStep = () => (
    <section className="workflow-step-panel">
      <div className="workflow-step-header">
        <div>
          <span className="workflow-kicker">Etapa 1</span>
          <h2>Cribado de articulos</h2>
          <p>Lanza una pregunta de investigacion y revisa decisiones include, review o exclude.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => loadScreeningRuns({ preserveSelection: true })}>
          <i className="fas fa-rotate-right"></i>
          <span>{loadingScreeningRuns ? 'Actualizando...' : 'Actualizar'}</span>
        </button>
      </div>

      <div className="workflow-action-card">
        <div className="screening-form-grid">
          <label className="screening-field screening-field-full">
            <span>Pregunta de investigacion</span>
            <textarea
              value={screeningForm.researchQuestion}
              onChange={(event) =>
                setScreeningForm((previous) => ({ ...previous, researchQuestion: event.target.value }))
              }
              placeholder="Ejemplo: estudios sobre prediccion estacional de sequia en el Mediterraneo."
              rows={4}
            />
          </label>

          <label className="screening-field">
            <span>Criterios de inclusion</span>
            <textarea
              value={screeningForm.inclusionCriteria}
              onChange={(event) =>
                setScreeningForm((previous) => ({ ...previous, inclusionCriteria: event.target.value }))
              }
              placeholder={'Un criterio por linea\nEjemplo: usa indices SPEI o SPI'}
              rows={5}
            />
          </label>

          <label className="screening-field">
            <span>Criterios de exclusion</span>
            <textarea
              value={screeningForm.exclusionCriteria}
              onChange={(event) =>
                setScreeningForm((previous) => ({ ...previous, exclusionCriteria: event.target.value }))
              }
              placeholder={'Un criterio por linea\nEjemplo: estudios puramente urbanos'}
              rows={5}
            />
          </label>
        </div>

        <div className="workflow-step-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreateScreening}
            disabled={creatingScreening || !screeningForm.researchQuestion.trim()}
          >
            <i className={`fas ${creatingScreening ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
            <span>{creatingScreening ? 'Encolando...' : 'Ejecutar cribado'}</span>
          </button>
          <button type="button" className="btn-secondary" onClick={() => changeStep('evidence')}>
            Saltar por ahora
          </button>
          <button type="button" className="btn-secondary" onClick={() => changeStep('evidence')}>
            Continuar con extraccion
          </button>
        </div>
      </div>

      <div className="workflow-step-results-grid">
        <aside className="workflow-runs-panel">
          <div className="workflow-panel-heading">
            <h3>Runs de cribado</h3>
            <span>{screeningRuns.length}</span>
          </div>

          {screeningRunsError ? <div className="workflow-error">{screeningRunsError}</div> : null}

          {!screeningRunsError && !loadingScreeningRuns && screeningRuns.length === 0 ? (
            <EmptyStepState
              icon="fa-layer-group"
              title="Sin cribados"
              message="Los runs que lances para esta coleccion apareceran aqui."
            />
          ) : null}

          <div className="workflow-run-list">
            {screeningRuns.map((run) => (
              <button
                key={run._id}
                type="button"
                className={`workflow-run-card ${selectedScreeningRunId === run._id ? 'active' : ''}`}
                onClick={() => setSelectedScreeningRunId(run._id)}
              >
                <span className="workflow-run-top">
                  <RunStatusBadge status={run.status} />
                  <small>{formatTimestamp(run.created_at)}</small>
                </span>
                <strong>{run.research_question}</strong>
                <span className="workflow-run-meta">
                  {(run.counts?.include || 0)} incluidos / {(run.counts?.review || 0)} revision / {(run.counts?.exclude || 0)} excluidos
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="workflow-detail-panel">
          {!selectedScreeningRun && !loadingScreeningResults ? (
            <EmptyStepState
              icon="fa-magnifying-glass-chart"
              title="Selecciona un cribado"
              message="Aqui veras resultados y podras ajustar manualmente los articulos en revision."
            />
          ) : null}

          {selectedScreeningRun ? (
            <>
              <div className="workflow-detail-header compact">
                <div>
                  <div className="workflow-inline-meta">
                    <RunStatusBadge status={selectedScreeningRun.status} />
                    <span>{formatTimestamp(selectedScreeningRun.created_at)}</span>
                  </div>
                  <h3>{selectedScreeningRun.research_question}</h3>
                </div>
                <div className="workflow-mini-metrics three">
                  <span><strong>{selectedScreeningRun.counts?.include || 0}</strong> Incluidos</span>
                  <span><strong>{selectedScreeningRun.counts?.review || 0}</strong> Revision</span>
                  <span><strong>{selectedScreeningRun.counts?.exclude || 0}</strong> Excluidos</span>
                </div>
              </div>

              {selectedScreeningRun.error_message ? <div className="workflow-error">{selectedScreeningRun.error_message}</div> : null}
              {screeningResultsError ? <div className="workflow-error">{screeningResultsError}</div> : null}

              <div className="screening-filter-row">
                {Object.entries(DECISION_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`screening-filter-chip ${screeningDecisionFilter === key ? 'active' : ''}`}
                    onClick={() => setScreeningDecisionFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loadingScreeningResults ? (
                <EmptyStepState icon="fa-spinner fa-spin" message="Cargando resultados del cribado..." />
              ) : null}

              {!loadingScreeningResults && filteredScreeningResults.length === 0 ? (
                <EmptyStepState
                  icon="fa-file-circle-question"
                  message={
                    isActiveRunStatus(selectedScreeningRun.status)
                      ? 'El cribado sigue en marcha. Los resultados apareceran al finalizar.'
                      : 'No hay articulos para este filtro.'
                  }
                />
              ) : null}

              {!loadingScreeningResults && filteredScreeningResults.length > 0 ? (
                <div className="screening-results-list">
                  {filteredScreeningResults.map((item) => (
                    <article
                      key={`${item.run_id}:${item.article_id}`}
                      className="screening-result-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenArticle(item.article_id, 'screening', selectedScreeningRunId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleOpenArticle(item.article_id, 'screening', selectedScreeningRunId)
                        }
                      }}
                    >
                      <div className="screening-result-top">
                        <h3>{item.article_title || formatArticleFallback(item.article_id)}</h3>
                        <span className={`screening-decision-pill ${item.decision}`}>
                          {formatDecision(item.decision)}
                        </span>
                      </div>
                      <div className="screening-result-body">
                        <span className="screening-result-label">Justificacion</span>
                        <p className="screening-result-reason">{item.reason}</p>
                      </div>
                      {item.decision === 'review' ? (
                        <div className="screening-result-actions">
                          <button
                            type="button"
                            className="screening-inline-action include"
                            disabled={updatingScreeningArticleId === item.article_id}
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
                            disabled={updatingScreeningArticleId === item.article_id}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleMoveReviewResult(item, 'exclude')
                            }}
                          >
                            <i className="fas fa-times"></i>
                            <span>Pasar a excluidos</span>
                          </button>
                        </div>
                      ) : null}
                      <div className="screening-result-footer">
                        <span>Confianza: {formatConfidence(item.confidence)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </section>
  )

  const renderEvidenceStep = () => (
    <section className="workflow-step-panel">
      <div className="workflow-step-header">
        <div>
          <span className="workflow-kicker">Etapa 2</span>
          <h2>Extraccion de evidencia</h2>
          <p>Genera fichas de objetivo, metodologia, datos, variables, metricas y hallazgos.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => loadEvidenceRuns({ preserveSelection: true })}>
          <i className="fas fa-rotate-right"></i>
          <span>{loadingEvidenceRuns ? 'Actualizando...' : 'Actualizar'}</span>
        </button>
      </div>

      <div className="workflow-action-card">
        <div className="workflow-form-section">
          <span className="workflow-field-label">Alcance de articulos</span>
          <div className="evidence-mode-grid" role="radiogroup" aria-label="Alcance de articulos">
            {SELECTION_MODE_OPTIONS.map((option) => {
              const isActive = evidenceForm.selectionMode === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`evidence-mode-card ${isActive ? 'active' : ''}`}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() =>
                    setEvidenceForm((previous) => ({
                      ...previous,
                      selectionMode: option.value,
                      screeningRunId: option.value === 'all' ? '' : previous.screeningRunId,
                    }))
                  }
                >
                  <span className="evidence-mode-card-icon">
                    <i className={`fas ${option.icon}`}></i>
                  </span>
                  <span className="evidence-mode-card-copy">
                    <strong>{option.title}</strong>
                    <p>{option.description}</p>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {evidenceForm.selectionMode !== 'all' ? (
          <div className="workflow-form-section">
            <span className="workflow-field-label">Screening base</span>
            {completedScreeningRuns.length === 0 ? (
              <div className="workflow-inline-warning">
                <i className="fas fa-circle-info"></i>
                <span>No hay cribados completados. Puedes extraer sobre toda la coleccion o ejecutar cribado primero.</span>
              </div>
            ) : (
              <div className="workflow-picker-list">
                {completedScreeningRuns.map((run) => (
                  <button
                    key={run._id}
                    type="button"
                    className={`workflow-picker-option ${evidenceForm.screeningRunId === run._id ? 'active' : ''}`}
                    onClick={() =>
                      setEvidenceForm((previous) => ({
                        ...previous,
                        screeningRunId: run._id,
                      }))
                    }
                  >
                    <span>{formatTimestamp(run.created_at)}</span>
                    <strong>{run.research_question}</strong>
                    <small>{run.counts?.include || 0} incluidos / {run.counts?.review || 0} revision</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="workflow-step-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreateEvidence}
            disabled={
              creatingEvidence ||
              (evidenceForm.selectionMode !== 'all' && !evidenceForm.screeningRunId)
            }
          >
            <i className={`fas ${creatingEvidence ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
            <span>{creatingEvidence ? 'Encolando...' : 'Ejecutar este paso'}</span>
          </button>
        </div>
      </div>

      <div className="workflow-step-results-grid">
        <aside className="workflow-runs-panel">
          <div className="workflow-panel-heading">
            <h3>Runs de extraccion</h3>
            <span>{evidenceRuns.length}</span>
          </div>

          {evidenceRunsError ? <div className="workflow-error">{evidenceRunsError}</div> : null}

          {!evidenceRunsError && !loadingEvidenceRuns && evidenceRuns.length === 0 ? (
            <EmptyStepState
              icon="fa-microscope"
              title="Sin extracciones"
              message="Puedes ejecutar esta etapa sin cribado usando toda la coleccion."
            />
          ) : null}

          <div className="workflow-run-list">
            {evidenceRuns.map((run) => {
              const baseScreening = run.screening_run_id ? screeningRunMap.get(run.screening_run_id) : null

              return (
                <button
                  key={run._id}
                  type="button"
                  className={`workflow-run-card ${selectedEvidenceRunId === run._id ? 'active' : ''}`}
                  onClick={() => setSelectedEvidenceRunId(run._id)}
                >
                  <span className="workflow-run-top">
                    <RunStatusBadge status={run.status} />
                    <small>{formatTimestamp(run.created_at)}</small>
                  </span>
                  <strong>{formatSelectionMode(run.selection_mode)}</strong>
                  {baseScreening ? <span className="workflow-run-note">{baseScreening.research_question}</span> : null}
                  <span className="workflow-run-meta">{run.processed_articles || 0} / {run.total_articles || 0} articulos</span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="workflow-detail-panel">
          {!selectedEvidenceRun && !loadingEvidenceResults ? (
            <EmptyStepState
              icon="fa-file-circle-question"
              title="Selecciona una extraccion"
              message="Aqui veras las fichas generadas por articulo."
            />
          ) : null}

          {selectedEvidenceRun ? (
            <>
              <div className="workflow-detail-header compact">
                <div>
                  <div className="workflow-inline-meta">
                    <RunStatusBadge status={selectedEvidenceRun.status} />
                    <span>{formatTimestamp(selectedEvidenceRun.created_at)}</span>
                  </div>
                  <h3>{formatSelectionMode(selectedEvidenceRun.selection_mode)}</h3>
                  <p>
                    {selectedEvidenceRun.screening_run_id
                      ? 'Basado en un screening completado'
                      : 'Trabajando sobre toda la coleccion activa'}
                  </p>
                </div>
                <div className="workflow-mini-metrics two">
                  <span><strong>{selectedEvidenceRun.processed_articles || 0}</strong> Procesados</span>
                  <span><strong>{selectedEvidenceRun.total_articles || 0}</strong> Totales</span>
                </div>
              </div>

              {selectedEvidenceRun.error_message ? <div className="workflow-error">{selectedEvidenceRun.error_message}</div> : null}
              {evidenceResultsError ? <div className="workflow-error">{evidenceResultsError}</div> : null}

              {loadingEvidenceResults ? (
                <EmptyStepState icon="fa-spinner fa-spin" message="Cargando fichas de evidencia..." />
              ) : null}

              {!loadingEvidenceResults && evidenceResults.length === 0 ? (
                <EmptyStepState
                  icon="fa-file-circle-question"
                  message={
                    isActiveRunStatus(selectedEvidenceRun.status)
                      ? 'La extraccion sigue en marcha. Las fichas apareceran al finalizar.'
                      : 'No hay fichas para este run.'
                  }
                />
              ) : null}

              {!loadingEvidenceResults && evidenceResults.length > 0 ? (
                <div className="evidence-results-list">
                  {evidenceResults.map((item) => (
                    <article
                      key={`${item.run_id}:${item.article_id}`}
                      className="evidence-result-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenArticle(item.article_id, 'evidence-extraction', selectedEvidenceRunId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleOpenArticle(item.article_id, 'evidence-extraction', selectedEvidenceRunId)
                        }
                      }}
                    >
                      <div className="evidence-result-top">
                        <h3>{item.article_title || formatArticleFallback(item.article_id)}</h3>
                        <div className="evidence-result-meta">
                          <span className="evidence-confidence-pill">Confianza {formatConfidence(item.confidence)}</span>
                        </div>
                      </div>

                      <div className="evidence-result-grid">
                        {hasText(item.objective) ? (
                          <FieldBlock label="Objetivo">
                            <p>{item.objective}</p>
                          </FieldBlock>
                        ) : null}
                        {hasText(item.methodology) ? (
                          <FieldBlock label="Metodologia">
                            <p>{item.methodology}</p>
                          </FieldBlock>
                        ) : null}
                        {hasText(item.dataset) ? (
                          <FieldBlock label="Dataset">
                            <p>{item.dataset}</p>
                          </FieldBlock>
                        ) : null}
                        <ListBlock label="Preguntas de investigacion" items={item.research_questions} />
                        <ListBlock label="Variables" items={item.variables} kind="chips" />
                        <ListBlock label="Metricas" items={item.metrics} kind="chips" />
                        <ListBlock label="Hallazgos" items={item.findings} />
                        <ListBlock label="Limitaciones" items={item.limitations} />
                        <ListBlock label="Trabajo futuro" items={item.future_work} />
                        <SupportBlock label="Soporte del objetivo" items={item.objective_support} />
                        <SupportBlock label="Soporte metodologico" items={item.methods_support} />
                        <SupportBlock label="Soporte de hallazgos" items={item.findings_support} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </section>
  )

  const renderClusteringStep = () => (
    <section className="workflow-step-panel">
      <div className="workflow-step-header">
        <div>
          <span className="workflow-kicker optional">Etapa opcional</span>
          <h2>Clustering tematico</h2>
          <p>Agrupa articulos a partir de una extraccion de evidencia completada. Puedes saltarlo.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => loadClusteringRuns({ preserveSelection: true })}>
          <i className="fas fa-rotate-right"></i>
          <span>{loadingClusteringRuns ? 'Actualizando...' : 'Actualizar'}</span>
        </button>
      </div>

      <div className="workflow-action-card">
        {completedEvidenceRuns.length === 0 ? (
          <div className="workflow-inline-warning strong">
            <i className="fas fa-circle-info"></i>
            <span>Clustering requiere una extraccion de evidencia completada. Puedes volver a extraccion o saltar a sintesis.</span>
          </div>
        ) : (
          <>
            <div className="workflow-form-section">
              <span className="workflow-field-label">Evidence extraction base</span>
              <div className="workflow-picker-list">
                {completedEvidenceRuns.map((run) => (
                  <button
                    key={run._id}
                    type="button"
                    className={`workflow-picker-option ${clusteringForm.evidenceRunId === run._id ? 'active' : ''}`}
                    onClick={() =>
                      setClusteringForm((previous) => ({
                        ...previous,
                        evidenceRunId: run._id,
                      }))
                    }
                  >
                    <span>{formatTimestamp(run.created_at)}</span>
                    <strong>{formatSelectionMode(run.selection_mode)}</strong>
                    <small>{run.processed_articles || 0} / {run.total_articles || 0} articulos</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="workflow-form-section">
              <span className="workflow-field-label">Modo de agrupacion</span>
              <div className="clustering-mode-grid" role="radiogroup" aria-label="Modo de agrupacion">
                {CLUSTER_MODE_OPTIONS.map((option) => {
                  const isActive = clusteringForm.clusterMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`clustering-mode-card ${isActive ? 'active' : ''}`}
                      role="radio"
                      aria-checked={isActive}
                      onClick={() =>
                        setClusteringForm((previous) => ({
                          ...previous,
                          clusterMode: option.value,
                        }))
                      }
                    >
                      <span className="clustering-mode-card-icon">
                        <i className={`fas ${option.icon}`}></i>
                      </span>
                      <span className="clustering-mode-card-copy">
                        <strong>{option.title}</strong>
                        <p>{option.description}</p>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {clusteringForm.clusterMode === 'manual' ? (
              <label className="workflow-number-field">
                <span className="workflow-field-label">Numero de clusters</span>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={clusteringForm.clusterCount}
                  onChange={(event) =>
                    setClusteringForm((previous) => ({
                      ...previous,
                      clusterCount: event.target.value,
                    }))
                  }
                />
              </label>
            ) : null}
          </>
        )}

        <div className="workflow-step-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreateClustering}
            disabled={creatingClustering || !clusteringForm.evidenceRunId || completedEvidenceRuns.length === 0}
          >
            <i className={`fas ${creatingClustering ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
            <span>{creatingClustering ? 'Encolando...' : 'Ejecutar clustering'}</span>
          </button>
          <button type="button" className="btn-secondary" onClick={() => changeStep('synthesis')}>
            Saltar por ahora
          </button>
          <button type="button" className="btn-secondary" onClick={() => changeStep('synthesis')}>
            Continuar con sintesis
          </button>
        </div>
      </div>

      <div className="workflow-step-results-grid">
        <aside className="workflow-runs-panel">
          <div className="workflow-panel-heading">
            <h3>Runs de clustering</h3>
            <span>{clusteringRuns.length}</span>
          </div>

          {clusteringRunsError ? <div className="workflow-error">{clusteringRunsError}</div> : null}

          {!clusteringRunsError && !loadingClusteringRuns && clusteringRuns.length === 0 ? (
            <EmptyStepState
              icon="fa-object-group"
              title="Sin clusterings"
              message="Esta etapa es opcional y solo aparece si quieres explorar agrupaciones."
            />
          ) : null}

          <div className="workflow-run-list">
            {clusteringRuns.map((run) => {
              const baseEvidence = run.evidence_extraction_run_id
                ? evidenceRunMap.get(run.evidence_extraction_run_id)
                : null

              return (
                <button
                  key={run._id}
                  type="button"
                  className={`workflow-run-card ${selectedClusteringRunId === run._id ? 'active' : ''}`}
                  onClick={() => setSelectedClusteringRunId(run._id)}
                >
                  <span className="workflow-run-top">
                    <RunStatusBadge status={run.status} />
                    <small>{formatTimestamp(run.created_at)}</small>
                  </span>
                  <strong>{run.selected_cluster_count || 0} clusters</strong>
                  <span className="workflow-run-note">
                    {baseEvidence ? formatSelectionMode(baseEvidence.selection_mode) : 'Evidence run base'}
                  </span>
                  <span className="workflow-run-meta">{run.processed_articles || 0} articulos / {formatSilhouette(run.silhouette_score)} silhouette</span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="workflow-detail-panel">
          {!selectedClusteringRun && !loadingClusteringResults ? (
            <EmptyStepState
              icon="fa-bezier-curve"
              title="Selecciona un clustering"
              message="Aqui veras clusters, resumenes y asignaciones por articulo."
            />
          ) : null}

          {selectedClusteringRun ? (
            <>
              <div className="workflow-detail-header compact">
                <div>
                  <div className="workflow-inline-meta">
                    <RunStatusBadge status={selectedClusteringRun.status} />
                    <span>{formatTimestamp(selectedClusteringRun.created_at)}</span>
                  </div>
                  <h3>{selectedClusteringRun.selected_cluster_count || 0} clusters generados</h3>
                </div>
                <div className="workflow-mini-metrics three">
                  <span><strong>{selectedClusteringRun.selected_cluster_count || 0}</strong> Clusters</span>
                  <span><strong>{selectedClusteringRun.processed_articles || 0}</strong> Articulos</span>
                  <span title="Silhouette: medida de cohesion de los clusters. Rango de -1 a 1; valores cercanos a 1 indican agrupaciones mas nitidas."><strong>{formatSilhouette(selectedClusteringRun.silhouette_score)}</strong> Silhouette</span>
                </div>
              </div>

              {selectedClusteringRun.error_message ? <div className="workflow-error">{selectedClusteringRun.error_message}</div> : null}
              {clusteringResultsError ? <div className="workflow-error">{clusteringResultsError}</div> : null}

              {loadingClusteringResults ? (
                <EmptyStepState icon="fa-spinner fa-spin" message="Cargando clusters..." />
              ) : null}

              {!loadingClusteringResults && groupedClusters.length === 0 ? (
                <EmptyStepState
                  icon="fa-shapes"
                  message={
                    isActiveRunStatus(selectedClusteringRun.status)
                      ? 'El clustering sigue en marcha. Los grupos apareceran al finalizar.'
                      : 'No hay grupos para este run.'
                  }
                />
              ) : null}

              {!loadingClusteringResults && groupedClusters.length > 0 ? (
                <div className="clustering-groups-list">
                  {groupedClusters.map((cluster) => (
                    <article key={cluster.cluster_id} className="clustering-group-card">
                      <div className="clustering-group-top">
                        <div>
                          <span className="clustering-group-kicker">Cluster</span>
                          <h3>{cluster.label}</h3>
                        </div>
                        <div className="clustering-group-stats">
                          <span>{cluster.size} articulos</span>
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
                            onClick={() => handleOpenArticle(item.article_id, 'clustering', selectedClusteringRunId)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleOpenArticle(item.article_id, 'clustering', selectedClusteringRunId)
                              }
                            }}
                          >
                            <div className="clustering-article-top">
                              <h4>{item.article_title || formatArticleFallback(item.article_id)}</h4>
                              <span className="clustering-similarity-pill">
                                Afinidad {formatSimilarity(item.similarity_score)}
                              </span>
                            </div>
                            {item.objective ? (
                              <p className="clustering-article-text">
                                <strong>Objetivo:</strong> {trimText(item.objective)}
                              </p>
                            ) : null}
                            {item.methodology ? (
                              <p className="clustering-article-text">
                                <strong>Metodologia:</strong> {trimText(item.methodology)}
                              </p>
                            ) : null}
                            {item.dataset ? (
                              <p className="clustering-article-text">
                                <strong>Dataset:</strong> {trimText(item.dataset, 140)}
                              </p>
                            ) : null}
                            <FieldPillList items={[...(item.variables || []), ...(item.metrics || [])]} />
                          </article>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </section>
  )

  const renderSynthesisStep = () => (
    <section className="workflow-step-panel">
      <div className="workflow-step-header">
        <div>
          <span className="workflow-kicker">Etapa 4</span>
          <h2>Sintesis de coleccion</h2>
          <p>Genera una respuesta integrada usando el contexto disponible para la coleccion activa.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => loadSynthesisRuns({ preserveSelection: true })}>
          <i className="fas fa-rotate-right"></i>
          <span>{loadingSynthesisRuns ? 'Actualizando...' : 'Actualizar'}</span>
        </button>
      </div>

      <div className="workflow-action-card">
        <label className="workflow-field-stack">
          <span className="workflow-field-label">Prompt de sintesis</span>
          <textarea
            className="collection-synthesis-textarea"
            value={synthesisPrompt}
            onChange={(event) => setSynthesisPrompt(event.target.value)}
            placeholder="Ejemplo: sintetiza los hallazgos principales, contradicciones y vacios de investigacion de esta coleccion."
            rows={7}
            disabled={creatingSynthesis}
          />
        </label>

        <div className="workflow-context-note">
          <i className="fas fa-circle-info"></i>
          <span>La sintesis puede ejecutarse aunque no hayas hecho clustering. Requiere al menos un articulo con PDF procesado en la coleccion y trabajara con el contenido de esos PDFs; los articulos sin PDF procesado no se incluiran.</span>
        </div>

        <div className="workflow-step-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCreateSynthesis}
            disabled={creatingSynthesis || !synthesisPrompt.trim()}
          >
            <i className={`fas ${creatingSynthesis ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
            <span>{creatingSynthesis ? 'Generando...' : 'Ejecutar sintesis'}</span>
          </button>
          <button type="button" className="btn-secondary" onClick={() => changeStep('writing')}>
            Ir a redaccion cientifica
          </button>
        </div>
      </div>

      <div className="workflow-step-results-grid">
        <aside className="workflow-runs-panel">
          <div className="workflow-panel-heading">
            <h3>Sintesis guardadas</h3>
            <span>{collectionSynthesisRuns.length}</span>
          </div>

          {synthesisRunsError ? <div className="workflow-error">{synthesisRunsError}</div> : null}

          {!synthesisRunsError && !loadingSynthesisRuns && collectionSynthesisRuns.length === 0 ? (
            <EmptyStepState
              icon="fa-diagram-project"
              title="Sin sintesis"
              message="Cada prompt queda guardado como run de esta coleccion."
            />
          ) : null}

          <div className="workflow-run-list">
            {collectionSynthesisRuns.map((run) => (
              <button
                key={run._id}
                type="button"
                className={`workflow-run-card ${selectedSynthesisRunId === run._id ? 'active' : ''}`}
                onClick={() => setSelectedSynthesisRunId(run._id)}
              >
                <span className="workflow-run-top">
                  <RunStatusBadge status={run.status} />
                  <small>{formatTimestamp(run.created_at)}</small>
                </span>
                <strong>{run.prompt}</strong>
                <span className="workflow-run-meta">Contexto: {formatContextSource(run.context_source)}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="workflow-detail-panel">
          {!selectedSynthesisRun && !loadingSynthesisRuns ? (
            <EmptyStepState
              icon="fa-diagram-project"
              title="Selecciona una sintesis"
              message="Aqui veras respuestas completadas, errores o runs en curso."
            />
          ) : null}

          {selectedSynthesisRun ? (
            <article className="workflow-synthesis-detail">
              <div className="workflow-detail-header compact">
                <div>
                  <div className="workflow-inline-meta">
                    <RunStatusBadge status={selectedSynthesisRun.status} />
                    <span>{formatTimestamp(selectedSynthesisRun.created_at)}</span>
                    <span>Contexto: {formatContextSource(selectedSynthesisRun.context_source)}</span>
                  </div>
                  <h3>{selectedSynthesisRun.prompt}</h3>
                </div>
              </div>

              {selectedSynthesisRun.error_message ? <div className="workflow-error">{selectedSynthesisRun.error_message}</div> : null}

              {selectedSynthesisRun.status === 'queued' ? (
                <EmptyStepState icon="fa-clock" title="Sintesis en cola" message="El worker la procesara en cuanto llegue su turno." />
              ) : null}

              {selectedSynthesisRun.status === 'processing' ? (
                <EmptyStepState icon="fa-spinner fa-spin" title="Generando sintesis" message="La consulta se esta resolviendo para esta coleccion." />
              ) : null}

              {selectedSynthesisRun.status === 'completed' ? (
                <div className="collection-synthesis-result-body">
                  <span className="collection-synthesis-result-label">Respuesta</span>
                  <div className="collection-synthesis-text-blocks">
                    {getTextBlocks(selectedSynthesisRun.response).map((block, index) => (
                      <p key={`${selectedSynthesisRun._id}-block-${index}`}>{block}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ) : null}
        </section>
      </div>
    </section>
  )

  const renderWritingStep = () => <ScientificWriting embedded />

  const renderActiveStep = () => {
    if (activeStep === 'preparation') return renderPreparationStep()
    if (activeStep === 'screening') return renderScreeningStep()
    if (activeStep === 'evidence') return renderEvidenceStep()
    if (activeStep === 'clustering') return renderClusteringStep()
    if (activeStep === 'writing') return renderWritingStep()
    return renderSynthesisStep()
  }

  if (!selectedCollectionId) {
    return (
      <div className="page-container collection-empty-state-page">
        <div className="collection-empty-state-card">
          <div className="collection-empty-state-icon">
            <i className="fas fa-folder-open"></i>
          </div>
          <h1>Selecciona una coleccion</h1>
          <p>Revision asistida trabaja sobre una coleccion concreta. Elige una en la barra superior para empezar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container review-workflow-page">
      <div className="container">
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Revision asistida</h1>
              <span className="header-subtitle">Coleccion activa: {collectionName}</span>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{completedSteps}</span>
                <span className="stat-label">Etapas con runs</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number pending">{activeRuns}</span>
                <span className="stat-label">Activos</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{collectionSummary.totalArticles}</span>
                <span className="stat-label">Articulos</span>
              </div>
            </div>
          </div>
        </div>

        {summaryError ? <div className="workflow-error">{summaryError}</div> : null}

        <div className="workflow-shell">
          <WorkflowStepSidebar steps={steps} activeStep={activeStep} onStepChange={changeStep} />
          <main className="workflow-main-panel">{renderActiveStep()}</main>
        </div>
      </div>

      <NotificationToast message={notification} onClose={() => setNotification('')} />
    </div>
  )
}

export default ReviewWorkflow
