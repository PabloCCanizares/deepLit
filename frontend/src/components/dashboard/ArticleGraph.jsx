import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { articleGraphAPI } from '../../api/index.js'
import '../../styles/dashboard/ArticleGraph.css'

// ─── constantes visuales ───────────────────────────────────────────────────────

const NODE_TYPES = ['Article', 'Author', 'Keyword', 'Category', 'Type']

const NODE_STYLES = {
  Article:  { color: '#6366f1', radius: 48, label: 'Artículo' },
  Author:   { color: '#10b981', radius: 38, label: 'Autor' },
  Keyword:  { color: '#f59e0b', radius: 32, label: 'Palabra clave' },
  Category: { color: '#ef4444', radius: 38, label: 'Categoría' },
  Type:     { color: '#8b5cf6', radius: 38, label: 'Tipo' },
}

const EDGE_LABELS = {
  WROTE:       'escribió',
  HAS_KEYWORD: 'keyword',
  IN_CATEGORY: 'categoría',
  OF_TYPE:     'tipo',
}

const WIDTH  = 1400
const HEIGHT = 820

// ─── parámetros de simulación ─────────────────────────────────────────────────

const SIM_ITERATIONS        = 300
const COLLISION_PASSES      = 5      // pasadas de resolución de colisiones/iter
const COLLISION_GAP         = 16     // px mínimos entre bordes
const REPULSION_K           = 1.8    // escala de la repulsión proporcional a radios
const ATTRACTION            = 0.025  // rigidez del muelle entre nodos conectados
const IDEAL_LENGTH          = 200    // dist ideal entre centros conectados (px)
const CENTER_FORCE          = 0.006  // gravedad al centro global (suave)
const EDGE_AVOID_EXTRA      = 22     // px de colchón extra alrededor del nodo
const EDGE_AVOID_STRENGTH   = 0.55   // cuánto se empuja fuera de la arista
const DAMPING               = 0.80

// ─── helpers ──────────────────────────────────────────────────────────────────

function getNodeStyle(type) {
  return NODE_STYLES[type] || { color: '#94a3b8', radius: 32, label: type }
}

function wrapLabel(text, radius) {
  if (!text) return ['']
  const PX_PER_CHAR = 6
  const maxChars = Math.max(4, Math.floor((radius * 1.72) / PX_PER_CHAR))
  if (text.length <= maxChars) return [text]

  const mid        = Math.floor(text.length / 2)
  const spaceLeft  = text.lastIndexOf(' ', mid)
  const spaceRight = text.indexOf(' ', mid)
  const cut =
    spaceLeft >= 1   ? spaceLeft
    : spaceRight > 0 ? spaceRight
    : maxChars

  const line1 = text.slice(0, cut).trim()
  const rest  = text.slice(cut).trim()
  const line2 = rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest
  return [line1, line2].filter(Boolean)
}

/** Endpoints de la arista sobre el borde de cada nodo (no en el centro). */
function edgeEndpoints(src, tgt) {
  const dx   = tgt.x - src.x
  const dy   = tgt.y - src.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux   = dx / dist
  const uy   = dy / dist
  return {
    x1: src.x + ux * getNodeStyle(src.type).radius,
    y1: src.y + uy * getNodeStyle(src.type).radius,
    x2: tgt.x - ux * (getNodeStyle(tgt.type).radius + 9),
    y2: tgt.y - uy * (getNodeStyle(tgt.type).radius + 9),
  }
}

// ─── layout inicial: bipartito con minimización de cruces por baricentro ──────
//
// Artículos en anillo interior. El resto se distribuye en anillo exterior
// ordenados por el ángulo medio (baricentro) de sus artículos conectados.
// Esto minimiza cruces desde el primer frame sin imponer zonas por tipo.

function buildInitialLayout(nodes, edges) {
  const nodeById  = new Map(nodes.map((n) => [n.id, n]))
  const neighbors = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    neighbors.get(e.source)?.push(e.target)
    neighbors.get(e.target)?.push(e.source)
  }

  const articles = nodes.filter((n) => n.type === 'Article')
  const others   = nodes.filter((n) => n.type !== 'Article')

  // Si no hay artículos, colocar todos en un círculo uniforme
  if (articles.length === 0) {
    return nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      const r     = Math.min(WIDTH, HEIGHT) * 0.33
      return { ...n, x: WIDTH / 2 + r * Math.cos(angle), y: HEIGHT / 2 + r * Math.sin(angle), vx: 0, vy: 0 }
    })
  }

  // Radio del anillo interior (artículos): crece con el número de artículos
  const innerR = Math.max(60, Math.min(190, 40 + articles.length * 55))
  // Radio del anillo exterior (resto): siempre más grande que el interior
  const outerR = Math.max(300, innerR + 190)

  // Ángulo de cada artículo en el anillo interior
  const artAngle = new Map()
  articles.forEach((n, i) => {
    artAngle.set(n.id, (i / articles.length) * Math.PI * 2 - Math.PI / 2)
  })

  // Baricentro circular de cada nodo periférico: media de ángulos de sus artículos vecinos
  const withBarycenter = others.map((node) => {
    const connArt = (neighbors.get(node.id) || []).filter(
      (nid) => nodeById.get(nid)?.type === 'Article',
    )
    if (connArt.length === 0) return { node, angle: 0 }
    const sx = connArt.reduce((s, nid) => s + Math.cos(artAngle.get(nid) ?? 0), 0)
    const sy = connArt.reduce((s, nid) => s + Math.sin(artAngle.get(nid) ?? 0), 0)
    return { node, angle: Math.atan2(sy, sx) }
  })

  // Ordenar por baricentro → minimiza cruces entre arista y anillo exterior
  withBarycenter.sort((a, b) => a.angle - b.angle)

  const outerAngle = new Map()
  withBarycenter.forEach(({ node }, i) => {
    outerAngle.set(node.id, (i / withBarycenter.length) * Math.PI * 2 - Math.PI / 2)
  })

  return nodes.map((n) => {
    if (n.type === 'Article') {
      const a = artAngle.get(n.id) ?? 0
      return { ...n, x: WIDTH / 2 + innerR * Math.cos(a), y: HEIGHT / 2 + innerR * Math.sin(a), vx: 0, vy: 0 }
    }
    const a = outerAngle.get(n.id) ?? 0
    return { ...n, x: WIDTH / 2 + outerR * Math.cos(a), y: HEIGHT / 2 + outerR * Math.sin(a), vx: 0, vy: 0 }
  })
}

// ─── simulación de fuerzas ────────────────────────────────────────────────────

function runForceLayout(nodes, edges) {
  if (!nodes.length) return []

  const positioned = buildInitialLayout(nodes, edges)

  const indexById = new Map(positioned.map((n, i) => [n.id, i]))
  const adjacency = edges
    .map((e) => {
      const si = indexById.get(e.source)
      const ti = indexById.get(e.target)
      return si !== undefined && ti !== undefined ? { si, ti } : null
    })
    .filter(Boolean)

  for (let iter = 0; iter < SIM_ITERATIONS; iter += 1) {

    // ── 1. Repulsión nodo–nodo proporcional a la suma de radios ──
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
        const d     = Math.sqrt(dSq)
        const minSep = rA + rB + COLLISION_GAP
        fx += ((dx / d) * REPULSION_K * minSep * minSep) / dSq
        fy += ((dy / d) * REPULSION_K * minSep * minSep) / dSq
      }

      // Gravedad suave al centro global
      fx += (WIDTH  / 2 - node.x) * CENTER_FORCE
      fy += (HEIGHT / 2 - node.y) * CENTER_FORCE

      node.vx = (node.vx + fx) * DAMPING
      node.vy = (node.vy + fy) * DAMPING
    }

    // ── 2. Atracción por aristas (muelle) ──
    for (const { si, ti } of adjacency) {
      const a  = positioned[si]
      const b  = positioned[ti]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d  = Math.sqrt(dx * dx + dy * dy) || 0.01
      const delta = (d - IDEAL_LENGTH) * ATTRACTION
      const fx = (dx / d) * delta
      const fy = (dy / d) * delta
      a.vx += fx;  a.vy += fy
      b.vx -= fx;  b.vy -= fy
    }

    // ── 3. Evitar que nodos no conectados queden sobre aristas ──
    for (const { si, ti } of adjacency) {
      const a   = positioned[si]
      const b   = positioned[ti]
      const edX = b.x - a.x
      const edY = b.y - a.y
      const edLenSq = edX * edX + edY * edY
      if (edLenSq < 1) continue

      for (let k = 0; k < positioned.length; k += 1) {
        if (k === si || k === ti) continue
        const p     = positioned[k]
        const avoid = getNodeStyle(p.type).radius + EDGE_AVOID_EXTRA
        // Proyectar p sobre el segmento a-b
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

    // ── 4. Integrar posiciones ──
    for (const node of positioned) {
      node.x += node.vx
      node.y += node.vy
      const r = getNodeStyle(node.type).radius + 2
      node.x = Math.max(r, Math.min(WIDTH  - r, node.x))
      node.y = Math.max(r, Math.min(HEIGHT - r, node.y))
    }

    // ── 5. Resolución directa de colisiones ──
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
            a.x -= ux * push;  a.y -= uy * push
            b.x += ux * push;  b.y += uy * push
            const rA = getNodeStyle(a.type).radius + 2
            const rB = getNodeStyle(b.type).radius + 2
            a.x = Math.max(rA, Math.min(WIDTH  - rA, a.x))
            a.y = Math.max(rA, Math.min(HEIGHT - rA, a.y))
            b.x = Math.max(rB, Math.min(WIDTH  - rB, b.x))
            b.y = Math.max(rB, Math.min(HEIGHT - rB, b.y))
          }
        }
      }
    }
  }

  return positioned
}

// ─── componente ───────────────────────────────────────────────────────────────

function ArticleGraph() {
  const [activeTypes, setActiveTypes] = useState(() => new Set(NODE_TYPES))
  const [hoveredNode, setHoveredNode] = useState(null)
  const containerRef = useRef(null)

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['article-graph'],
    queryFn: async () => {
      const response = await articleGraphAPI.getGraph({ limit: 300 })
      if (!response?.success) throw new Error(response?.message || 'No se pudo cargar el grafo')
      return response.data || {}
    },
    refetchOnWindowFocus: false,
  })

  const enabled  = data?.enabled !== false
  const allNodes = useMemo(() => data?.nodes || [], [data])
  const allEdges = useMemo(() => data?.edges || [], [data])
  const stats    = data?.stats

  const filteredNodes = useMemo(
    () => allNodes.filter((n) => activeTypes.has(n.type)),
    [allNodes, activeTypes],
  )

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id))
    return allEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
  }, [allEdges, filteredNodes])

  const positionedNodes = useMemo(
    () => runForceLayout(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges],
  )

  const positionsById = useMemo(() => {
    const m = new Map()
    for (const n of positionedNodes) m.set(n.id, n)
    return m
  }, [positionedNodes])

  const toggleType = (type) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next.size === 0 ? new Set([type]) : next
    })
  }

  useEffect(() => { setHoveredNode(null) }, [activeTypes])

  return (
    <div className="article-graph" ref={containerRef}>

      <div className="article-graph__header">
        <div>
          <h3 className="sectionTitle">Grafo de Conocimiento</h3>
          <p className="article-graph__subtitle">
            Vista interactiva del grafo Neo4j construido a partir de tus artículos.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary article-graph__refresh"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
        >
          <i className={`fas fa-sync-alt ${isRefetching ? 'fa-spin' : ''}`}></i>
          {isRefetching ? 'Actualizando' : 'Actualizar'}
        </button>
      </div>

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
        <div className="article-graph__stats">
          <span className="article-graph__stat"><strong>{stats.articles}</strong> artículos</span>
          <span className="article-graph__stat"><strong>{stats.authors}</strong> autores</span>
          <span className="article-graph__stat"><strong>{stats.keywords}</strong> keywords</span>
          <span className="article-graph__stat"><strong>{stats.categories}</strong> categorías</span>
          <span className="article-graph__stat"><strong>{stats.types}</strong> tipos</span>
          <span className="article-graph__stat"><strong>{stats.relationships}</strong> relaciones</span>
        </div>
      )}

      <div className="article-graph__legend">
        {NODE_TYPES.map((type) => {
          const style    = getNodeStyle(type)
          const isActive = activeTypes.has(type)
          return (
            <button
              type="button"
              key={type}
              onClick={() => toggleType(type)}
              className={`article-graph__legend-item${isActive ? ' is-active' : ''}`}
            >
              <span className="article-graph__legend-dot" style={{ backgroundColor: style.color }} />
              {style.label}
            </button>
          )
        })}
      </div>

      <div className="article-graph__canvas-wrapper">
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
            className="article-graph__canvas"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Grafo de conocimiento de artículos"
          >
            <defs>
              <marker
                id="ag-arrow"
                viewBox="0 0 10 10"
                refX="9" refY="5"
                markerWidth="7" markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>

            {/* ── Aristas (detrás de los nodos) ── */}
            <g>
              {filteredEdges.map((edge, idx) => {
                const src = positionsById.get(edge.source)
                const tgt = positionsById.get(edge.target)
                if (!src || !tgt) return null

                const { x1, y1, x2, y2 } = edgeEndpoints(src, tgt)
                const mx  = (x1 + x2) / 2
                const my  = (y1 + y2) / 2
                const lbl = EDGE_LABELS[edge.type] || edge.type
                // Mostrar etiqueta solo si la arista tiene longitud suficiente
                const edgeLen  = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
                const showLbl  = edgeLen > 45
                const bgW      = lbl.length * 5.2 + 12
                const bgH      = 15

                return (
                  <g key={`e-${edge.source}-${edge.target}-${idx}`}>
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      className="article-graph__edge"
                      markerEnd="url(#ag-arrow)"
                    />
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

            {/* ── Nodos (encima de las aristas) ── */}
            <g>
              {positionedNodes.map((node) => {
                const style     = getNodeStyle(node.type)
                const isHovered = hoveredNode?.id === node.id
                const lines     = wrapLabel(node.label, style.radius)
                const lineH     = 13
                const startY    = lines.length === 1 ? 0 : -(lineH / 2)

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onFocus={() => setHoveredNode(node)}
                    onBlur={() => setHoveredNode(null)}
                    tabIndex={0}
                    className={`article-graph__node${isHovered ? ' is-hovered' : ''}`}
                  >
                    {/* Sombra */}
                    <circle r={style.radius + 3} fill="rgba(0,0,0,0.09)" cy={2} />
                    {/* Círculo principal */}
                    <circle
                      r={style.radius}
                      fill={style.color}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? 4 : 2}
                    />
                    {/* Texto dentro */}
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
          </svg>
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
