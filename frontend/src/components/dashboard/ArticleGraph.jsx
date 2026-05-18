import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { articleGraphAPI } from '../../api/index.js'
import { useArticlesEvents } from '../../hooks/useArticlesEvents.js'
import ArticleNodeCard from './ArticleNodeCard.jsx'
import '../../styles/dashboard/ArticleGraph.css'

const NODE_TYPES = [
  'Artículo', 'Autor', 'PalabraClave', 'Categoría', 'Tipo',
  'Organización', 'Problema', 'Concepto', 'Método', 'Modelo',
  'Dataset', 'Métrica', 'Hallazgo', 'Limitación',
]

const SEMANTIC_TYPES = new Set([
  'Organización', 'Problema', 'Concepto', 'Método', 'Modelo',
  'Dataset', 'Métrica', 'Hallazgo', 'Limitación',
])

const NODE_STYLES = {
  'Artículo':     { color: '#6366f1', radius: 48, label: 'Artículo' },
  'Autor':        { color: '#10b981', radius: 38, label: 'Autor' },
  'PalabraClave': { color: '#f59e0b', radius: 32, label: 'Palabra clave' },
  'Categoría':    { color: '#ef4444', radius: 38, label: 'Categoría' },
  'Tipo':         { color: '#8b5cf6', radius: 38, label: 'Tipo' },
  'Organización': { color: '#ec4899', radius: 30, label: 'Organización' },
  'Problema':     { color: '#dc2626', radius: 30, label: 'Problema' },
  'Concepto':     { color: '#0ea5e9', radius: 30, label: 'Concepto' },
  'Método':       { color: '#f97316', radius: 30, label: 'Método' },
  'Modelo':       { color: '#7c3aed', radius: 30, label: 'Modelo' },
  'Dataset':      { color: '#84cc16', radius: 28, label: 'Dataset' },
  'Métrica':      { color: '#ca8a04', radius: 28, label: 'Métrica' },
  'Hallazgo':     { color: '#a855f7', radius: 28, label: 'Hallazgo' },
  'Limitación':   { color: '#64748b', radius: 28, label: 'Limitación' },
}

const EDGE_LABELS = {
  ESCRIBE:            'escribe',
  TIENE_KEYWORD:      'keyword',
  EN_CATEGORIA:       'categoría',
  ES_TIPO:            'tipo',
  MENCIONA:           'menciona',
  ABORDA_PROBLEMA:    'aborda',
  CUBRE_CONCEPTO:     'cubre',
  USA_METODO:         'método',
  PROPONE_MODELO:     'propone',
  USA_DATASET:        'dataset',
  EVALUA_CON:         'evalúa',
  REPORTA_HALLAZGO:   'hallazgo',
  REPORTA_LIMITACION: 'limitación',
  RESUELVE:           'resuelve',
  CONSTRUYE_SOBRE:    'construye',
  USADO_PARA:         'usado para',
  RELACIONADO_CON:    'relacionado',
  APOYA:              'apoya',
  CONTRADICE:         'contradice',
}

const SIM_NODE_CONFIG = {
  // Grafo base — neo4j_label: etiqueta real en Neo4j
  'Artículo':     { neo4j_label: 'Article',  node_id_prop: 'article_id', label_prop: 'title', getId: (n) => n.article_id },
  'Autor':        { neo4j_label: 'Author',   node_id_prop: 'name_lower', label_prop: 'name',  getId: (n) => n.label?.toLowerCase() },
  'PalabraClave': { neo4j_label: 'Keyword',  node_id_prop: 'key_lower',  label_prop: 'key',   getId: (n) => n.label?.toLowerCase() },
  'Categoría':    { neo4j_label: 'Category', node_id_prop: 'name_lower', label_prop: 'name',  getId: (n) => n.label?.toLowerCase() },
  'Tipo':         { neo4j_label: 'Type',     node_id_prop: 'name_lower', label_prop: 'name',  getId: (n) => n.label?.toLowerCase() },
  // Tipos semánticos KG — todos usan la etiqueta :Entity en Neo4j
  'Organización': { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Problema':     { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Concepto':     { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Método':       { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Modelo':       { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Dataset':      { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Métrica':      { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Hallazgo':     { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
  'Limitación':   { neo4j_label: 'Entity', node_id_prop: 'entity_key', label_prop: 'name', getId: (n) => n.entity_key },
}

const WIDTH    = 1400
const HEIGHT   = 820
const FLOW_DUR = 2.5

const SIM_ITERATIONS      = 300
const COLLISION_PASSES    = 5
const COLLISION_GAP       = 16
const REPULSION_K         = 1.8
const ATTRACTION          = 0.025
const IDEAL_LENGTH        = 320
const CENTER_FORCE        = 0.006
const EDGE_AVOID_EXTRA    = 22
const EDGE_AVOID_STRENGTH = 0.55
const DAMPING             = 0.80

const DEFAULT_NODE_STYLE = { color: '#94a3b8', radius: 32, label: '' }

function getNodeStyle(type) {
  return NODE_STYLES[type] || { ...DEFAULT_NODE_STYLE, label: type }
}

function wrapLabel(text, radius) {
  if (!text) return ['']
  const PX_PER_CHAR = 6
  const maxChars = Math.max(4, Math.floor((radius * 1.72) / PX_PER_CHAR))
  if (text.length <= maxChars) return [text]

  const mid        = Math.floor(text.length / 2)
  const spaceLeft  = text.lastIndexOf(' ', mid)
  const spaceRight = text.indexOf(' ', mid)
  const cut = spaceLeft >= 1 ? spaceLeft : spaceRight > 0 ? spaceRight : maxChars

  const line1 = text.slice(0, cut).trim()
  const rest  = text.slice(cut).trim()
  const line2 = rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest
  return [line1, line2].filter(Boolean)
}

function edgeEndpoints(src, tgt) {
  const dx = tgt.x - src.x
  const dy = tgt.y - src.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  return {
    x1: src.x + ux * getNodeStyle(src.type).radius,
    y1: src.y + uy * getNodeStyle(src.type).radius,
    x2: tgt.x - ux * (getNodeStyle(tgt.type).radius + 9),
    y2: tgt.y - uy * (getNodeStyle(tgt.type).radius + 9),
  }
}

function buildInitialLayout(nodes, edges) {
  const nodeById  = new Map(nodes.map((n) => [n.id, n]))
  const neighbors = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    neighbors.get(e.source)?.push(e.target)
    neighbors.get(e.target)?.push(e.source)
  }

  const articles = nodes.filter((n) => n.type === 'Artículo')
  const others   = nodes.filter((n) => n.type !== 'Artículo')

  if (articles.length === 0) {
    return nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      const r     = Math.min(WIDTH, HEIGHT) * 0.33
      return { ...n, x: WIDTH / 2 + r * Math.cos(angle), y: HEIGHT / 2 + r * Math.sin(angle), vx: 0, vy: 0 }
    })
  }

  const innerR = Math.max(80, Math.min(300, 60 + articles.length * 75))
  const outerR = Math.max(450, innerR + 280)

  const artAngle = new Map()
  articles.forEach((n, i) => {
    artAngle.set(n.id, (i / articles.length) * Math.PI * 2 - Math.PI / 2)
  })

  const withBarycenter = others.map((node) => {
    const connArt = (neighbors.get(node.id) || []).filter(
      (nid) => nodeById.get(nid)?.type === 'Artículo',
    )
    if (connArt.length === 0) return { node, angle: 0 }
    const sx = connArt.reduce((s, nid) => s + Math.cos(artAngle.get(nid) ?? 0), 0)
    const sy = connArt.reduce((s, nid) => s + Math.sin(artAngle.get(nid) ?? 0), 0)
    return { node, angle: Math.atan2(sy, sx) }
  })
  withBarycenter.sort((a, b) => a.angle - b.angle)

  const outerAngle = new Map()
  withBarycenter.forEach(({ node }, i) => {
    outerAngle.set(node.id, (i / withBarycenter.length) * Math.PI * 2 - Math.PI / 2)
  })

  return nodes.map((n) => {
    if (n.type === 'Artículo') {
      const a = artAngle.get(n.id) ?? 0
      return { ...n, x: WIDTH / 2 + innerR * Math.cos(a), y: HEIGHT / 2 + innerR * Math.sin(a), vx: 0, vy: 0 }
    }
    const a = outerAngle.get(n.id) ?? 0
    return { ...n, x: WIDTH / 2 + outerR * Math.cos(a), y: HEIGHT / 2 + outerR * Math.sin(a), vx: 0, vy: 0 }
  })
}

function runForceLayout(nodes, edges) {
  if (!nodes.length) return []

  const positioned = buildInitialLayout(nodes, edges)
  const indexById  = new Map(positioned.map((n, i) => [n.id, i]))
  const adjacency  = edges
    .map((e) => {
      const si = indexById.get(e.source)
      const ti = indexById.get(e.target)
      return si !== undefined && ti !== undefined ? { si, ti } : null
    })
    .filter(Boolean)

  for (let iter = 0; iter < SIM_ITERATIONS; iter += 1) {
    for (let i = 0; i < positioned.length; i += 1) {
      const node = positioned[i]
      const rA   = getNodeStyle(node.type).radius
      let fx = 0, fy = 0

      for (let j = 0; j < positioned.length; j += 1) {
        if (i === j) continue
        const other = positioned[j]
        const rB    = getNodeStyle(other.type).radius
        const dx    = node.x - other.x
        const dy    = node.y - other.y
        let dSq     = dx * dx + dy * dy
        if (dSq < 1) dSq = 1
        const d      = Math.sqrt(dSq)
        const minSep = rA + rB + COLLISION_GAP
        fx += ((dx / d) * REPULSION_K * minSep * minSep) / dSq
        fy += ((dy / d) * REPULSION_K * minSep * minSep) / dSq
      }

      fx += (WIDTH  / 2 - node.x) * CENTER_FORCE
      fy += (HEIGHT / 2 - node.y) * CENTER_FORCE

      node.vx = (node.vx + fx) * DAMPING
      node.vy = (node.vy + fy) * DAMPING
    }

    for (const { si, ti } of adjacency) {
      const a  = positioned[si]
      const b  = positioned[ti]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d  = Math.sqrt(dx * dx + dy * dy) || 0.01
      const delta = (d - IDEAL_LENGTH) * ATTRACTION
      const fx = (dx / d) * delta
      const fy = (dy / d) * delta
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    for (const { si, ti } of adjacency) {
      const a       = positioned[si]
      const b       = positioned[ti]
      const edX     = b.x - a.x
      const edY     = b.y - a.y
      const edLenSq = edX * edX + edY * edY
      if (edLenSq < 1) continue

      for (let k = 0; k < positioned.length; k += 1) {
        if (k === si || k === ti) continue
        const p     = positioned[k]
        const avoid = getNodeStyle(p.type).radius + EDGE_AVOID_EXTRA
        const t  = Math.max(0, Math.min(1, ((p.x - a.x) * edX + (p.y - a.y) * edY) / edLenSq))
        const cx = a.x + t * edX
        const cy = a.y + t * edY
        const px = p.x - cx
        const py = p.y - cy
        const d  = Math.sqrt(px * px + py * py) || 0.01
        if (d < avoid) {
          const push = ((avoid - d) / d) * EDGE_AVOID_STRENGTH
          p.vx += px * push
          p.vy += py * push
        }
      }
    }

    for (const node of positioned) {
      node.x += node.vx
      node.y += node.vy
    }

    for (let pass = 0; pass < COLLISION_PASSES; pass += 1) {
      for (let i = 0; i < positioned.length; i += 1) {
        for (let j = i + 1; j < positioned.length; j += 1) {
          const a = positioned[i]
          const b = positioned[j]
          const minD = getNodeStyle(a.type).radius + getNodeStyle(b.type).radius + COLLISION_GAP
          const dx   = b.x - a.x
          const dy   = b.y - a.y
          const d    = Math.sqrt(dx * dx + dy * dy) || 0.01
          if (d < minD) {
            const push = (minD - d) / 2
            const ux   = dx / d
            const uy   = dy / d
            a.x -= ux * push; a.y -= uy * push
            b.x += ux * push; b.y += uy * push
          }
        }
      }
    }
  }

  return positioned
}

function findShortestPath(edges, sourceId, targetId) {
  if (sourceId === targetId) return [sourceId]
  const queue   = [[sourceId]]
  const visited = new Set([sourceId])
  while (queue.length > 0) {
    const path    = queue.shift()
    const current = path[path.length - 1]
    for (const edge of edges) {
      const next = edge.source === current ? edge.target
                 : edge.target === current ? edge.source
                 : null
      if (next === null) continue
      if (next === targetId) return [...path, next]
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([...path, next])
      }
    }
  }
  return null
}

function ArticleGraph() {
  const [activeTypes,       setActiveTypes]       = useState(() => new Set(NODE_TYPES))
  const [hoveredNode,       setHoveredNode]       = useState(null)
  const [isDragging,        setIsDragging]        = useState(false)
  const [nodePositions,     setNodePositions]     = useState({})
  const [showLegend,        setShowLegend]        = useState(false)
  const [guideMode,         setGuideMode]         = useState(false)
  const [pathOrigin,        setPathOrigin]        = useState(null)
  const [pathDest,          setPathDest]          = useState(null)
  const [shortestPath,      setShortestPath]      = useState(null)
  const [viewport,          setViewport]          = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning,         setIsPanning]         = useState(false)
  const [showSearch,        setShowSearch]        = useState(false)
  const [searchQuery,       setSearchQuery]       = useState('')
  const [searchTypes,       setSearchTypes]       = useState(() => new Set(NODE_TYPES))
  const [showSearchFilter,  setShowSearchFilter]  = useState(false)
  const [showSimilarity,    setShowSimilarity]    = useState(false)
  const [simNode,           setSimNode]           = useState(null)
  const [simOp,             setSimOp]             = useState('gte')
  const [simThreshold,      setSimThreshold]      = useState(70)
  const [simResultSet,      setSimResultSet]      = useState(null)
  const [simLoading,        setSimLoading]        = useState(false)
  const [cardNode,          setCardNode]          = useState(null)
  const [isExpanding,       setIsExpanding]       = useState(false)
  const [expansionError,    setExpansionError]    = useState(null)
  const [expansionProgress, setExpansionProgress] = useState({ total: 0, current: 0, article: '' })
  const [showExpandConfig,  setShowExpandConfig]  = useState(false)
  const [expandSchema,      setExpandSchema]      = useState(null)
  const [typeLimits,        setTypeLimits]        = useState({})
  const [isFullscreen,      setIsFullscreen]      = useState(false)

  const lastClickRef     = useRef({ id: null, time: 0 })
  const expansionPollRef = useRef(null)
  const containerRef     = useRef(null)
  const graphWrapperRef  = useRef(null)
  const svgRef           = useRef(null)
  const draggingRef      = useRef(null)
  const legendRef        = useRef(null)
  const viewportRef      = useRef({ x: 0, y: 0, scale: 1 })
  const isPanningRef     = useRef(null)
  const queryClient      = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['article-graph'],
    queryFn: async () => {
      const response = await articleGraphAPI.getGraph({ limit: 300 })
      if (!response?.success) throw new Error(response?.message || 'No se pudo cargar el grafo')
      return response.data || {}
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  useArticlesEvents({
    onArticleReady: () => queryClient.invalidateQueries({ queryKey: ['article-graph'] }),
  })

  const enabled  = data?.enabled !== false
  const allNodes = useMemo(() => data?.nodes || [], [data])
  const allEdges = useMemo(() => data?.edges || [], [data])
  const stats    = data?.stats

  const presentTypes = useMemo(() => new Set(allNodes.map((n) => n.type)), [allNodes])
  const isAlreadyExpanded = useMemo(
    () => [...SEMANTIC_TYPES].some((t) => presentTypes.has(t)),
    [presentTypes],
  )

  useEffect(() => {
    if (presentTypes.size === 0) return
    setActiveTypes((prev) => {
      const next = new Set(prev)
      for (const t of presentTypes) next.add(t)
      return next
    })
    setSearchTypes((prev) => {
      const next = new Set(prev)
      for (const t of presentTypes) next.add(t)
      return next
    })
  }, [presentTypes])

  useEffect(() => {
    if (!isExpanding) {
      if (expansionPollRef.current) {
        clearInterval(expansionPollRef.current)
        expansionPollRef.current = null
      }
      return
    }
    expansionPollRef.current = setInterval(async () => {
      try {
        const res = await articleGraphAPI.getExpansionStatus()
        if (!res?.success) return
        const d = res.data || {}
        setExpansionProgress({ total: d.total || 0, current: d.current || 0, article: d.article || '' })
        if (d.status === 'done' || d.status === 'error') {
          setIsExpanding(false)
          if (d.status === 'error') {
            setExpansionError('La expansión semántica encontró un error. Revisa los logs del servidor.')
          }
          await queryClient.refetchQueries({ queryKey: ['article-graph'] })
        }
      } catch { /* silencioso */ }
    }, 2000)
    return () => {
      clearInterval(expansionPollRef.current)
      expansionPollRef.current = null
    }
  }, [isExpanding, queryClient])

  const handleOpenExpansionConfig = async () => {
    setExpansionError(null)
    setShowExpandConfig(true)
    if (expandSchema) return
    try {
      const res = await articleGraphAPI.getExpansionSchema()
      if (!res?.success) return
      const schema = res.data || {}
      setExpandSchema(schema)
      const defaults = {}
      for (const nodeType of schema.node_types || []) {
        defaults[nodeType] = 1
      }
      setTypeLimits(defaults)
    } catch (err) {
      console.error('No se pudo cargar el esquema de expansión:', err)
      setExpansionError('No se pudo cargar la configuración de expansión.')
      setShowExpandConfig(false)
    }
  }

  const handleTypeLimitChange = (nodeType, value) => {
    const num = Number(value)
    const safe = Number.isFinite(num) ? Math.max(0, Math.min(10, Math.round(num))) : 0
    setTypeLimits((prev) => ({ ...prev, [nodeType]: safe }))
  }

  const handleConfirmExpansion = async () => {
    setExpansionError(null)
    try {
      const res = await articleGraphAPI.startExpansion({ typeLimits })
      if (res?.success) {
        setShowExpandConfig(false)
        setIsExpanding(true)
        setExpansionProgress({ total: 0, current: 0, article: '' })
      } else {
        setExpansionError(res?.message || 'No se pudo iniciar la expansión.')
      }
    } catch (err) {
      console.error('Error iniciando expansión:', err)
      setExpansionError('Error de red al iniciar la expansión.')
    }
  }

  const positionedNodes = useMemo(
    () => runForceLayout(allNodes, allEdges),
    [allNodes, allEdges],
  )

  useEffect(() => {
    if (positionedNodes.length === 0) return
    const map = {}
    for (const n of positionedNodes) map[n.id] = { x: n.x, y: n.y }
    setNodePositions(map)
  }, [positionedNodes])

  const displayNodes = useMemo(
    () => positionedNodes.map((n) => ({
      ...n,
      x: nodePositions[n.id]?.x ?? n.x,
      y: nodePositions[n.id]?.y ?? n.y,
    })),
    [positionedNodes, nodePositions],
  )

  const positionsById = useMemo(() => {
    const m = new Map()
    for (const n of displayNodes) m.set(n.id, n)
    return m
  }, [displayNodes])

  const visibleNodes = useMemo(
    () => displayNodes.filter((n) => activeTypes.has(n.type)),
    [displayNodes, activeTypes],
  )

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((n) => n.id))
    return allEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
  }, [allEdges, visibleNodes])

  const shortestPathSet = useMemo(() => new Set(shortestPath || []), [shortestPath])

  const shortestPathEdgeSet = useMemo(() => {
    if (!shortestPath || shortestPath.length < 2) return new Set()
    const s = new Set()
    for (let i = 0; i < shortestPath.length - 1; i++) {
      s.add(`${shortestPath[i]}|${shortestPath[i + 1]}`)
      s.add(`${shortestPath[i + 1]}|${shortestPath[i]}`)
    }
    return s
  }, [shortestPath])

  const flowPathD = useMemo(() => {
    if (!shortestPath || shortestPath.length < 2) return null
    let d = ''
    for (let i = 0; i < shortestPath.length - 1; i++) {
      const src = positionsById.get(shortestPath[i])
      const tgt = positionsById.get(shortestPath[i + 1])
      if (!src || !tgt) return null
      const { x1, y1, x2, y2 } = edgeEndpoints(src, tgt)
      d += `M ${x1} ${y1} L ${x2} ${y2} `
    }
    return d.trim()
  }, [shortestPath, positionsById])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return displayNodes
      .filter((n) => searchTypes.has(n.type) && n.label?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, searchTypes, displayNodes])

  const focusNode = (node) => {
    const style = getNodeStyle(node.type)
    const zoomScale = HEIGHT / (style.radius * 4)
    setViewport({
      scale: zoomScale,
      x: node.x - WIDTH  / (2 * zoomScale),
      y: node.y - HEIGHT / (2 * zoomScale),
    })
    setHoveredNode(node)
    setShowSearch(false)
    setSearchQuery('')
    setShowSearchFilter(false)
  }

  const toggleType = (type) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next.size === 0 ? new Set([type]) : next
    })
  }

  useEffect(() => { setHoveredNode(null) }, [activeTypes])

  useEffect(() => {
    if (!showLegend && !showSearch) return
    const handleOutside = (e) => {
      if (!legendRef.current?.contains(e.target)) {
        setShowLegend(false)
        setShowSearch(false)
        setShowSearchFilter(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showLegend, showSearch])

  useEffect(() => { viewportRef.current = viewport }, [viewport])

  // ── Fullscreen ──────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const handleFullscreen = () => {
    const el = graphWrapperRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(console.error)
    } else {
      document.exitFullscreen().catch(console.error)
    }
  }
  // ─────────────────────────────────────────────────────────

  const handleZoom = (factor) => {
    setViewport((prev) => {
      const newScale = Math.min(6, Math.max(0.2, prev.scale * factor))
      const cx = prev.x + WIDTH  / (2 * prev.scale)
      const cy = prev.y + HEIGHT / (2 * prev.scale)
      return {
        scale: newScale,
        x: cx - WIDTH  / (2 * newScale),
        y: cy - HEIGHT / (2 * newScale),
      }
    })
  }

  const handleZoomReset = () => setViewport({ x: 0, y: 0, scale: 1 })

  const getSVGCoords = (clientX, clientY) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }

  const handleSimSearch = async () => {
    if (!simNode) return
    const cfg = SIM_NODE_CONFIG[simNode.type]
    if (!cfg) return
    const nodeIdValue = cfg.getId(simNode)
    if (!nodeIdValue) return

    setSimLoading(true)
    try {
      await articleGraphAPI.computeEmbeddings()

      const response = await articleGraphAPI.getSimilar({
        node_label:     cfg.neo4j_label,      // etiqueta Neo4j real (no el tipo en español)
        node_id_prop:   cfg.node_id_prop,
        node_id_value:  nodeIdValue,
        label_prop:     cfg.label_prop,
        min_similarity: 0,
        top_k:          50,
      })
      if (!response?.success) { setSimResultSet(new Set()); return }

      const thresh   = simThreshold / 100
      const filtered = (response.data?.results || []).filter(({ similarity_score: s }) => {
        if (simOp === 'gte') return s >= thresh
        if (simOp === 'lte') return s <= thresh
        if (simOp === 'eq')  return Math.abs(s - thresh) <= 0.05
        return false
      })

      const isEntityType = cfg.neo4j_label === 'Entity'
      const matchIds = new Set()
      for (const result of filtered) {
        const match = allNodes.find((n) => {
          if (simNode.type === 'Artículo') return String(n.article_id) === String(result.node_id)
          if (isEntityType)               return n.entity_key === result.node_id  // cross-type entity similarity
          if (n.type !== simNode.type)    return false
          return n.label?.toLowerCase() === result.node_id
        })
        if (match) matchIds.add(match.id)
      }
      setSimResultSet(matchIds)
    } catch (err) {
      console.error('Similitud:', err)
      setSimResultSet(new Set())
    } finally {
      setSimLoading(false)
    }
  }

  const handleNodeClick = (node) => {
    if (node.type === 'Artículo') {
      const now = Date.now()
      if (lastClickRef.current.id === node.id && now - lastClickRef.current.time < 400) {
        lastClickRef.current = { id: null, time: 0 }
        setCardNode(node)
        return
      }
      lastClickRef.current = { id: node.id, time: now }
    }

    if (showSimilarity) {
      setSimNode(node)
      setSimResultSet(null)
      return
    }
    if (!guideMode) return
    if (!pathOrigin) {
      setPathOrigin(node); setPathDest(null); setShortestPath(null)
    } else if (!pathDest) {
      if (node.id === pathOrigin.id) return
      setPathDest(node)
      setShortestPath(findShortestPath(allEdges, pathOrigin.id, node.id))
    } else {
      setPathOrigin(node); setPathDest(null); setShortestPath(null)
    }
  }

  const handleNodeMouseDown = (e, node) => {
    e.preventDefault()
    e.stopPropagation()
    const { x, y } = getSVGCoords(e.clientX, e.clientY)
    const pos = nodePositions[node.id] || node
    draggingRef.current = { id: node.id, type: node.type, ox: x - pos.x, oy: y - pos.y, hasMoved: false, clickNode: node }
    setIsDragging(true)
    setHoveredNode(null)
  }

  const handleNodeTouchStart = (e, node) => {
    if (e.touches.length !== 1) return
    e.preventDefault()
    const t = e.touches[0]
    const { x, y } = getSVGCoords(t.clientX, t.clientY)
    const pos = nodePositions[node.id] || node
    draggingRef.current = { id: node.id, type: node.type, ox: x - pos.x, oy: y - pos.y, hasMoved: false, clickNode: node }
    setIsDragging(true)
  }

  const applyDrag = (clientX, clientY) => {
    if (!draggingRef.current) return
    const { id, type, ox, oy } = draggingRef.current
    const { x, y } = getSVGCoords(clientX, clientY)
    const r = getNodeStyle(type).radius
    draggingRef.current.hasMoved = true
    setNodePositions((prev) => ({
      ...prev,
      [id]: {
        x: Math.max(r + 2, Math.min(WIDTH  - r - 2, x - ox)),
        y: Math.max(r + 2, Math.min(HEIGHT - r - 2, y - oy)),
      },
    }))
  }

  const handleSVGMouseDown = (e) => {
    if (e.button !== 0 || draggingRef.current) return
    const vp = viewportRef.current
    isPanningRef.current = { clientX: e.clientX, clientY: e.clientY, vx: vp.x, vy: vp.y, scale: vp.scale }
    setIsPanning(true)
  }

  const handleSVGMouseMove = (e) => {
    if (draggingRef.current) {
      applyDrag(e.clientX, e.clientY)
      return
    }
    if (!isPanningRef.current) return
    const { clientX, clientY, vx, vy, scale } = isPanningRef.current
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const dx = (e.clientX - clientX) / rect.width  * (WIDTH  / scale)
    const dy = (e.clientY - clientY) / rect.height * (HEIGHT / scale)
    isPanningRef.current.hasMoved = true
    setViewport((prev) => ({ ...prev, x: vx - dx, y: vy - dy }))
  }

  const handleSVGTouchMove = (e) => {
    if (e.touches.length === 1) applyDrag(e.touches[0].clientX, e.touches[0].clientY)
  }

  const handleDragEnd = (e) => {
    if (draggingRef.current && !draggingRef.current.hasMoved) handleNodeClick(draggingRef.current.clickNode)
    if (e?.type === 'mouseup' && !draggingRef.current && !isPanningRef.current?.hasMoved) {
      setPathOrigin(null); setPathDest(null); setShortestPath(null)
      setSimNode(null); setSimResultSet(null)
    }
    draggingRef.current = null
    isPanningRef.current = null
    setIsDragging(false)
    setIsPanning(false)
  }

  return (
    <div className="article-graph" ref={containerRef}>

      {!enabled && (
        <div className="article-graph__notice">
          <i className="fas fa-info-circle"></i>
          <span>
            {data?.message
              || 'Neo4j no está configurado. Define NEO4J_URL, NEO4J_USERNAME y NEO4J_PASSWORD en el .env del backend.'}
          </span>
        </div>
      )}

      {stats && (
        <div className="article-graph__kpis">
          {[
            { key: 'articles',      label: 'Artículos',  color: '#6366f1' },
            { key: 'authors',       label: 'Autores',    color: '#10b981' },
            { key: 'categories',    label: 'Categorías', color: '#ef4444' },
            { key: 'types',         label: 'Tipos',      color: '#8b5cf6' },
            { key: 'keywords',      label: 'Keywords',   color: '#f59e0b' },
            { key: 'relationships', label: 'Relaciones', color: '#64748b' },
          ].map(({ key, label, color }) => (
            <div key={key} className="article-graph__kpi" style={{ '--kpi-color': color }}>
              <span className="article-graph__kpi-value">{stats[key] ?? 0}</span>
              <span className="article-graph__kpi-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="article-graph__canvas-wrapper" ref={graphWrapperRef}>

        {showExpandConfig && !isExpanding && (
          <div className="article-graph__expand-overlay" role="dialog" aria-modal="true">
            <div className="article-graph__expand-box article-graph__expand-box--config">
              {!expandSchema && (
                <span className="article-graph__expand-counter">Cargando esquema…</span>
              )}

              {expandSchema && (
                <div className="article-graph__expand-grid">
                  {(expandSchema.node_types || []).map((nodeType) => (
                    <div key={nodeType} className="article-graph__expand-row">
                      <span
                        className="article-graph__expand-row-color"
                        style={{ background: NODE_STYLES[nodeType]?.color ?? '#94a3b8' }}
                      />
                      <span className="article-graph__expand-row-label">{nodeType}</span>
                      <div className="article-graph__expand-stepper">
                        <button
                          type="button"
                          className="article-graph__expand-stepper-btn"
                          onClick={() => handleTypeLimitChange(nodeType, (typeLimits[nodeType] ?? 1) - 1)}
                          disabled={(typeLimits[nodeType] ?? 1) <= 0}
                        >−</button>
                        <span className="article-graph__expand-stepper-val">{typeLimits[nodeType] ?? 1}</span>
                        <button
                          type="button"
                          className="article-graph__expand-stepper-btn"
                          onClick={() => handleTypeLimitChange(nodeType, (typeLimits[nodeType] ?? 1) + 1)}
                          disabled={(typeLimits[nodeType] ?? 1) >= 10}
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <span className="article-graph__expand-subtitle">
                Máximo de entidades que la IA extraerá por artículo para cada tipo semántico.
              </span>

              <div className="article-graph__expand-actions">
                <button
                  type="button"
                  className="article-graph__expand-btn article-graph__expand-btn--ghost"
                  onClick={() => setShowExpandConfig(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="article-graph__expand-btn article-graph__expand-btn--primary"
                  onClick={handleConfirmExpansion}
                  disabled={!expandSchema}
                >
                  <i className="fas fa-wand-magic-sparkles" />
                  Expandir
                </button>
              </div>
            </div>
          </div>
        )}

        {isExpanding && (
          <div className="article-graph__expand-overlay">
            <div className="article-graph__expand-box">
              <div className="article-graph__kgloader">
                <svg viewBox="0 0 72 72" width="72" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Static faint background edges */}
                  <line x1="16" y1="16" x2="56" y2="16" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.2"/>
                  <line x1="56" y1="16" x2="56" y2="56" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.2"/>
                  <line x1="56" y1="56" x2="16" y2="56" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.2"/>
                  <line x1="16" y1="56" x2="16" y2="16" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.2"/>
                  {/* Cross connections */}
                  <line x1="16" y1="16" x2="56" y2="56" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.15"/>
                  <line x1="56" y1="16" x2="16" y2="56" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.15"/>
                  {/* Traveling segment along perimeter */}
                  <path d="M16,16 L56,16 L56,56 L16,56 Z"
                        stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray="18 142" className="kgloader-traveler"/>
                  {/* Corner nodes */}
                  <circle cx="16" cy="16" r="5.5" fill="#7c3aed" className="kgloader-node" style={{animationDelay:'0s'}}/>
                  <circle cx="56" cy="16" r="5.5" fill="#a855f7" className="kgloader-node" style={{animationDelay:'0.35s'}}/>
                  <circle cx="56" cy="56" r="5.5" fill="#7c3aed" className="kgloader-node" style={{animationDelay:'0.7s'}}/>
                  <circle cx="16" cy="56" r="5.5" fill="#a855f7" className="kgloader-node" style={{animationDelay:'1.05s'}}/>
                </svg>
              </div>
              <span className="article-graph__expand-title">Expandiendo grafo semántico…</span>
              {expansionProgress.article && (
                <span className="article-graph__expand-article">{expansionProgress.article}</span>
              )}
              <div className="article-graph__expand-bar-track">
                <div
                  className="article-graph__expand-bar-fill"
                  style={{
                    width: expansionProgress.total > 0
                      ? `${Math.round((expansionProgress.current / expansionProgress.total) * 100)}%`
                      : '5%',
                  }}
                />
              </div>
              <span className="article-graph__expand-counter">
                {expansionProgress.total > 0
                  ? `${expansionProgress.current} / ${expansionProgress.total} artículos`
                  : 'Iniciando…'}
              </span>
            </div>
          </div>
        )}

        {expansionError && (
          <div className="article-graph__expand-error" onClick={() => setExpansionError(null)} title="Click para cerrar">
            <i className="fas fa-circle-exclamation" />
            {expansionError}
          </div>
        )}

        <div className="article-graph__zoom-controls">
          <button type="button" className="article-graph__zoom-btn" title="Acercar" onClick={() => handleZoom(1.25)}>
            <i className="fas fa-plus" />
          </button>
          <button type="button" className="article-graph__zoom-btn" title="Alejar" onClick={() => handleZoom(0.8)}>
            <i className="fas fa-minus" />
          </button>
          <button type="button" className="article-graph__zoom-btn" title="Restablecer vista" onClick={handleZoomReset}>
            <i className="fas fa-expand-arrows-alt" />
          </button>
        </div>

        <button
          type="button"
          className="article-graph__fullscreen-btn"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          onClick={handleFullscreen}
        >
          <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
        </button>

        <div className="article-graph__legend" ref={legendRef}>
          <div className="article-graph__legend-controls">
            <button
              type="button"
              className={`article-graph__legend-trigger article-graph__expand-btn${isAlreadyExpanded ? ' is-active' : ''}`}
              title={isAlreadyExpanded
                ? 'Grafo semántico expandido. Click para re-expandir con nuevos artículos.'
                : 'Expandir grafo semántico usando IA'}
              onClick={handleOpenExpansionConfig}
              disabled={isExpanding || showExpandConfig || !enabled}
              style={{ opacity: !enabled ? 0.4 : 1 }}
            >
              <i className={`fas ${isAlreadyExpanded ? 'fa-circle-check' : 'fa-wand-magic-sparkles'}`} />
              {isAlreadyExpanded ? 'Expandido' : 'Expandir'}
            </button>
            <span className="article-graph__legend-separator" />
            <button
              type="button"
              className={`article-graph__legend-trigger${showLegend ? ' is-active' : ''}`}
              onClick={() => {
                const next = !showLegend
                setShowLegend(next)
                if (next) {
                  setGuideMode(false)
                  setShowSimilarity(false); setSimNode(null); setSimResultSet(null); setSimThreshold(0); setSimOp('gte')
                  setShowSearch(false); setSearchQuery(''); setShowSearchFilter(false)
                  setPathOrigin(null); setPathDest(null); setShortestPath(null)
                }
              }}
            >
              <i className="fas fa-eye" />
              Mostrar
              <i className={`fas fa-chevron-${showLegend ? 'up' : 'down'} article-graph__legend-chevron`} />
            </button>
            <span className="article-graph__legend-separator" />
            <button
              type="button"
              className={`article-graph__legend-trigger${guideMode ? ' is-active' : ''}`}
              onClick={() => {
                const next = !guideMode
                setGuideMode(next)
                if (next) {
                  setShowLegend(false)
                  setShowSimilarity(false); setSimNode(null); setSimResultSet(null); setSimThreshold(0); setSimOp('gte')
                  setShowSearch(false); setSearchQuery(''); setShowSearchFilter(false)
                }
                setPathOrigin(null); setPathDest(null); setShortestPath(null)
              }}
            >
              <i className="fas fa-route" />
              Enrutador
            </button>
            <span className="article-graph__legend-separator" />
            <button
              type="button"
              className={`article-graph__legend-trigger${showSimilarity ? ' is-active' : ''}`}
              title="Similitud de nodo"
              onClick={() => {
                const next = !showSimilarity
                setShowSimilarity(next)
                if (next) {
                  setShowLegend(false)
                  setGuideMode(false); setPathOrigin(null); setPathDest(null); setShortestPath(null)
                  setShowSearch(false); setSearchQuery(''); setShowSearchFilter(false)
                }
                setSimNode(null); setSimResultSet(null); setSimThreshold(0); setSimOp('gte')
              }}
            >
              <i className="fas fa-share-nodes" />
              Similitud
            </button>
            <span className="article-graph__legend-separator" />
            <button
              type="button"
              className={`article-graph__legend-trigger${showSearch ? ' is-active' : ''}`}
              title="Buscar nodo"
              onClick={() => {
                const next = !showSearch
                setShowSearch(next)
                if (next) {
                  setShowLegend(false)
                  setGuideMode(false); setPathOrigin(null); setPathDest(null); setShortestPath(null)
                  setShowSimilarity(false); setSimNode(null); setSimResultSet(null); setSimThreshold(0); setSimOp('gte')
                } else {
                  setSearchQuery(''); setShowSearchFilter(false)
                }
              }}
            >
              <i className="fas fa-search" />
              Buscar
            </button>
          </div>

          {showLegend && (
            <div
              className="article-graph__legend-dropdown"
              style={{ maxHeight: isAlreadyExpanded ? '5.4rem' : '2.8rem' }}
              onWheel={(e) => { e.stopPropagation(); e.currentTarget.scrollTop += e.deltaY }}
            >
              {NODE_TYPES.filter((type) => presentTypes.has(type)).map((type, idx) => {
                const style    = getNodeStyle(type)
                const isActive = activeTypes.has(type)
                return (
                  <div key={type} style={{ display: 'contents' }}>
                    {idx > 0 && <span className="article-graph__legend-separator" />}
                    <button
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`article-graph__legend-item${isActive ? ' is-active' : ''}`}
                    >
                      <span className="article-graph__legend-dot" style={{ backgroundColor: style.color }} />
                      {style.label}
                      <i className={`fas ${isActive ? 'fa-eye' : 'fa-eye-slash'} article-graph__legend-eye`} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {guideMode && (
            <div className="article-graph__legend-dropdown">
              <div className="article-graph__legend-item is-active" style={{ cursor: 'default' }}>
                Origen
                <span
                  className="article-graph__guide-node-name"
                  style={{ color: pathOrigin ? getNodeStyle(pathOrigin.type).color : undefined }}
                >
                  {pathOrigin?.label || '—'}
                </span>
              </div>
              <span className="article-graph__legend-separator" />
              <div className="article-graph__legend-item is-active" style={{ cursor: 'default' }}>
                Destino
                <span
                  className="article-graph__guide-node-name"
                  style={{ color: pathDest ? getNodeStyle(pathDest.type).color : undefined }}
                >
                  {pathDest?.label || '—'}
                </span>
              </div>
              <span className="article-graph__legend-separator" />
              <div className="article-graph__legend-item is-active" style={{ cursor: 'default' }}>
                Longitud
                <span className="article-graph__guide-node-name">
                  {shortestPath ? shortestPath.length - 1 : '—'}
                </span>
              </div>
              {(pathOrigin || pathDest) && (
                <>
                  <span className="article-graph__legend-separator" />
                  <button
                    type="button"
                    className="article-graph__legend-item is-active"
                    onClick={() => { setPathOrigin(null); setPathDest(null); setShortestPath(null) }}
                  >
                    <i className="fas fa-eraser" style={{ fontSize: '0.72rem' }} />
                  </button>
                </>
              )}
            </div>
          )}

          {showSimilarity && (
            <div className="article-graph__legend-dropdown article-graph__sim-panel">
              <div className="article-graph__legend-item is-active" style={{ cursor: 'default' }}>
                Nodo
                <span
                  className="article-graph__guide-node-name"
                  style={{ color: simNode ? getNodeStyle(simNode.type).color : undefined }}
                >
                  {simNode?.label || '—'}
                </span>
              </div>
              <span className="article-graph__legend-separator" />
              <div className="article-graph__legend-item is-active" style={{ cursor: 'default', padding: '0 0.25rem' }}>
                <select
                  className="article-graph__sim-op-select"
                  value={simOp}
                  onChange={(e) => setSimOp(e.target.value)}
                >
                  <option value="gte">mayor o igual</option>
                  <option value="lte">menor o igual</option>
                  <option value="eq">igual a</option>
                </select>
              </div>
              <span className="article-graph__legend-separator" />
              <div className="article-graph__legend-item is-active" style={{ cursor: 'default', gap: '0.5rem', flexShrink: 1 }}>
                <input
                  type="range"
                  className="article-graph__sim-slider"
                  min={0}
                  max={100}
                  value={simThreshold}
                  style={{ '--val': simThreshold }}
                  onChange={(e) => setSimThreshold(Number(e.target.value))}
                />
                <span className="article-graph__sim-value">{simThreshold}%</span>
              </div>
              <span className="article-graph__legend-separator" />
              <button
                type="button"
                className="article-graph__legend-item is-active"
                onClick={handleSimSearch}
                disabled={!simNode || simLoading}
                style={{
                  opacity: (!simNode || simLoading) ? 0.45 : 1,
                  cursor:  (!simNode || simLoading) ? 'not-allowed' : 'pointer',
                }}
                title="Buscar nodos similares"
              >
                {simLoading
                  ? <i className="fas fa-spinner fa-spin" style={{ fontSize: '0.72rem' }} />
                  : <i className="fas fa-search" style={{ fontSize: '0.72rem' }} />}
                Buscar
              </button>
              {(simNode || simResultSet !== null) && (
                <>
                  <span className="article-graph__legend-separator" />
                  <button
                    type="button"
                    className="article-graph__legend-item is-active"
                    onClick={() => { setSimNode(null); setSimResultSet(null) }}
                  >
                    <i className="fas fa-eraser" style={{ fontSize: '0.72rem' }} />
                  </button>
                </>
              )}
            </div>
          )}

          {showSearch && (
            <div className="article-graph__search-panel">
              <div className="article-graph__legend-item is-active" style={{ cursor: 'default' }}>
                <i className="fas fa-search" style={{ color: '#94a3b8', fontSize: '0.72rem', flexShrink: 0 }} />
                <input
                  className="article-graph__search-input"
                  placeholder="Buscar nodo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className={`article-graph__search-filter-btn${showSearchFilter ? ' is-active' : ''}`}
                  onClick={() => setShowSearchFilter((v) => !v)}
                  title="Filtrar por tipo"
                >
                  <i className="fas fa-filter" />
                </button>
              </div>

              {showSearchFilter && (
                <>
                  <div className="article-graph__search-divider" />
                  <div className="article-graph__search-type-row">
                    {NODE_TYPES.filter((type) => presentTypes.has(type)).map((type, idx) => {
                      const style  = getNodeStyle(type)
                      const active = searchTypes.has(type)
                      return (
                        <div key={type} style={{ display: 'contents' }}>
                          {idx > 0 && <span className="article-graph__legend-separator" />}
                          <button
                            type="button"
                            className={`article-graph__legend-item${active ? ' is-active' : ''}`}
                            onClick={() => setSearchTypes((prev) => {
                              const next = new Set(prev)
                              next.has(type) ? next.delete(type) : next.add(type)
                              return next.size === 0 ? new Set([type]) : next
                            })}
                          >
                            <span className="article-graph__legend-dot" style={{ backgroundColor: style.color }} />
                            {style.label}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {searchQuery.trim() && (
                <>
                  <div className="article-graph__search-divider" />
                  {searchResults.length > 0 ? (
                    searchResults.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className="article-graph__legend-item is-active article-graph__search-result"
                        onClick={() => focusNode(node)}
                      >
                        <span
                          className="article-graph__legend-dot"
                          style={{ backgroundColor: getNodeStyle(node.type).color }}
                        />
                        {node.label}
                      </button>
                    ))
                  ) : (
                    <div className="article-graph__legend-item is-active" style={{ cursor: 'default', opacity: 0.5 }}>
                      Sin resultados
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="article-graph__placeholder">
            <i className="fas fa-spinner fa-spin"></i>
            <span>Cargando grafo...</span>
          </div>
        ) : error ? (
          <div className="article-graph__placeholder article-graph__placeholder--error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error.message || 'Error al cargar el grafo'}</span>
          </div>
        ) : positionedNodes.length === 0 ? (
          <div className="article-graph__placeholder">
            <i className="fas fa-project-diagram"></i>
            <span>
              {enabled
                ? 'Aún no hay datos en el grafo. Sube artículos para empezar a construirlo.'
                : 'El grafo se mostrará aquí cuando Neo4j esté disponible.'}
            </span>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className={`article-graph__canvas${isDragging ? ' is-dragging' : ''}${isPanning ? ' is-panning' : ''}`}
            viewBox={`${viewport.x} ${viewport.y} ${WIDTH / viewport.scale} ${HEIGHT / viewport.scale}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Grafo de conocimiento de artículos"
            onMouseDown={handleSVGMouseDown}
            onMouseMove={handleSVGMouseMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchMove={handleSVGTouchMove}
            onTouchEnd={handleDragEnd}
          >
            <g>
              {visibleEdges.map((edge, idx) => {
                const src = positionsById.get(edge.source)
                const tgt = positionsById.get(edge.target)
                if (!src || !tgt) return null

                const dimmedEdge =
                  (!!shortestPath && !shortestPathEdgeSet.has(`${edge.source}|${edge.target}`)) ||
                  (simResultSet !== null
                    && !simResultSet.has(edge.source) && !simResultSet.has(edge.target)
                    && edge.source !== simNode?.id && edge.target !== simNode?.id)

                const { x1, y1, x2, y2 } = edgeEndpoints(src, tgt)
                const mx  = (x1 + x2) / 2
                const my  = (y1 + y2) / 2
                const lbl = EDGE_LABELS[edge.type] || edge.type
                const edgeLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
                const showLbl = edgeLen > 45
                const bgW = lbl.length * 5.2 + 12
                const bgH = 15

                return (
                  <g key={`e-${edge.source}-${edge.target}-${idx}`} opacity={dimmedEdge ? 0.08 : 1}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} className="article-graph__edge" />
                    {showLbl && (
                      <>
                        <rect
                          x={mx - bgW / 2} y={my - bgH / 2}
                          width={bgW} height={bgH}
                          rx={4}
                          className="article-graph__edge-label-bg"
                        />
                        <text
                          x={mx} y={my}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="article-graph__edge-label"
                        >
                          {lbl}
                        </text>
                      </>
                    )}
                  </g>
                )
              })}
            </g>

            <g>
              {visibleNodes.map((node) => {
                const style      = getNodeStyle(node.type)
                const isHovered  = hoveredNode?.id === node.id
                const dimmedNode =
                  (!!shortestPath && !shortestPathSet.has(node.id)) ||
                  (simResultSet !== null && !simResultSet.has(node.id) && node.id !== simNode?.id)
                const lines  = wrapLabel(node.label, style.radius)
                const lineH  = 13
                const startY = lines.length === 1 ? 0 : -(lineH / 2)

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    opacity={dimmedNode ? 0.18 : 1}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onMouseEnter={() => !draggingRef.current && setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onTouchStart={(e) => handleNodeTouchStart(e, node)}
                    onFocus={() => setHoveredNode(node)}
                    onBlur={() => setHoveredNode(null)}
                    tabIndex={0}
                    className={`article-graph__node${isHovered ? ' is-hovered' : ''}${guideMode || showSimilarity ? ' guide-mode' : ''}`}
                  >
                    <circle r={style.radius + 3} fill="rgba(0,0,0,0.09)" cy={2} />
                    <circle
                      r={style.radius}
                      fill={style.color}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 4 : 2}
                    />
                    {lines.map((line, i) => (
                      <text
                        key={i}
                        x={0}
                        y={startY + i * lineH}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="article-graph__node-label-inside"
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                )
              })}
            </g>

            {flowPathD && (
              <>
                <path id="ag-flow-path" d={flowPathD} fill="none" stroke="none" />
                <g className="article-graph__traveler">
                  <circle cx={-32} cy={0} r={1}   fill="#fbbf24" opacity={0.08} />
                  <circle cx={-24} cy={0} r={1.5} fill="#fbbf24" opacity={0.18} />
                  <circle cx={-16} cy={0} r={2}   fill="#fbbf24" opacity={0.35} />
                  <circle cx={-8}  cy={0} r={2.5} fill="#fbbf24" opacity={0.60} />
                  <circle cx={0}   cy={0} r={4}   fill="#fbbf24" />
                  <animateMotion dur={`${FLOW_DUR}s`} repeatCount="indefinite" calcMode="paced" rotate="auto">
                    <mpath href="#ag-flow-path" />
                  </animateMotion>
                </g>
              </>
            )}
          </svg>
        )}

        {cardNode && (
          <ArticleNodeCard
            node={cardNode}
            allNodes={allNodes}
            allEdges={allEdges}
            onClose={() => setCardNode(null)}
          />
        )}

        {hoveredNode && (
          <div className="article-graph__tooltip">
            <strong>{hoveredNode.label || 'Sin nombre'}</strong>
            <span className="article-graph__tooltip-type">
              {getNodeStyle(hoveredNode.type).label}
              {hoveredNode.year ? ` · ${hoveredNode.year}` : ''}
            </span>
          </div>
        )}
      </div>

    </div>
  )
}

export default ArticleGraph
