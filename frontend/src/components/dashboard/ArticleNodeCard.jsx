import { useState, useEffect, useMemo, useRef } from 'react'
import { articlesAPI } from '../../api/index.js'
import { articleGraphAPI } from '../../api/index.js'

const NODE_COLORS = {
  Article:  '#6366f1',
  Author:   '#10b981',
  Keyword:  '#f59e0b',
  Category: '#ef4444',
  Type:     '#8b5cf6',
}

const REL_LABELS = {
  WROTE:       'autor',
  HAS_KEYWORD: 'keyword',
  IN_CATEGORY: 'categoría',
  OF_TYPE:     'tipo',
}

function Section({ title, icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="anc-section">
      <button className="anc-section-hdr" onClick={() => setOpen(v => !v)}>
        <i className={`fas ${icon}`} />
        <span>{title}{count !== undefined ? ` (${count})` : ''}</span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} anc-chevron`} />
      </button>
      {open && <div className="anc-section-body">{children}</div>}
    </div>
  )
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="anc-field">
      <span className="anc-field-label">{label}</span>
      <span className="anc-field-value">{value}</span>
    </div>
  )
}

export default function ArticleNodeCard({ node, allNodes, allEdges, onClose }) {
  const cardRef = useRef(null)
  const [article, setArticle]     = useState(null)
  const [artLoading, setArtLoading] = useState(true)
  const [simResults, setSimResults] = useState([])
  const [simLoading, setSimLoading] = useState(true)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const stop = (e) => e.stopPropagation()
    el.addEventListener('wheel', stop, { passive: true })
    return () => el.removeEventListener('wheel', stop)
  }, [])

  useEffect(() => {
    if (!node?.article_id) return

    setArticle(null)
    setArtLoading(true)
    articlesAPI.getById(node.article_id)
      .then(r => setArticle(r?.data ?? null))
      .catch(() => setArticle(null))
      .finally(() => setArtLoading(false))

    setSimResults([])
    setSimLoading(true)
    articleGraphAPI.getSimilar({
      node_label:     'Article',
      node_id_prop:   'article_id',
      node_id_value:  node.article_id,
      label_prop:     'title',
      min_similarity: 0,
      top_k:          50,
    })
      .then(r => {
        const results = r?.data?.results ?? []
        results.sort((a, b) => b.similarity_score - a.similarity_score)
        setSimResults(results)
      })
      .catch(() => setSimResults([]))
      .finally(() => setSimLoading(false))
  }, [node?.article_id])

  const neighbors = useMemo(() => {
    if (!node) return []
    const out = []
    for (const edge of allEdges) {
      if (edge.source === node.id) {
        const n = allNodes.find(n2 => n2.id === edge.target)
        if (n) out.push({ neighbor: n, relType: edge.type })
      } else if (edge.target === node.id) {
        const n = allNodes.find(n2 => n2.id === edge.source)
        if (n) out.push({ neighbor: n, relType: edge.type })
      }
    }
    return out
  }, [allEdges, allNodes, node])

  if (!node) return null

  const authorsText = Array.isArray(article?.authors)
    ? article.authors.join(', ')
    : (article?.authors || '')

  const keywordsText = Array.isArray(article?.keywords)
    ? article.keywords
        .map(k => (typeof k === 'string' ? k : (k?.key || k?.display_name || '')))
        .filter(Boolean)
        .join(', ')
    : (typeof article?.keywords === 'string' ? article.keywords : '')

  return (
    <div className="article-node-card" ref={cardRef}>
      {/* ── Cabecera ── */}
      <div className="anc-header">
        <div className="anc-header-badge">
          <span className="anc-header-dot" style={{ background: NODE_COLORS.Article }} />
          <span className="anc-header-type">Artículo</span>
        </div>
        <span className="anc-header-title" title={node.label}>{node.label}</span>
        <button className="anc-close" onClick={onClose} aria-label="Cerrar">
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="anc-sections">

        {/* ── 1) Información ── */}
        <Section title="Información" icon="fa-file-alt" defaultOpen>
          {artLoading ? (
            <div className="anc-loading"><i className="fas fa-circle-notch fa-spin" /></div>
          ) : !article ? (
            <p className="anc-empty">No se pudo cargar el artículo</p>
          ) : (
            <div className="anc-fields">
              <Field label="Autores"    value={authorsText} />
              <Field label="Año"        value={article.year} />
              <Field label="Categoría"  value={article.category} />
              <Field label="Tipo"       value={article.type} />
              <Field label="Páginas"    value={article.pages} />
              <Field label="Citas"      value={article.citations} />
              {article.relevance_score !== null && article.relevance_score !== undefined && (
                <Field label="Relevancia" value={String(article.relevance_score)} />
              )}
              <Field label="DOI"        value={article.doi} />
              <Field label="Estado"     value={article.status} />
              {keywordsText && <Field label="Keywords" value={keywordsText} />}
              {article.abstract && (
                <div className="anc-abstract">
                  <span className="anc-field-label">Abstract</span>
                  <p className="anc-abstract-text">{article.abstract}</p>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── 2) Relaciones ── */}
        <Section title="Relaciones en el grafo" icon="fa-project-diagram" count={neighbors.length}>
          {neighbors.length === 0 ? (
            <p className="anc-empty">Sin relaciones visibles</p>
          ) : (
            <ul className="anc-rel-list">
              {neighbors.map((item, i) => (
                <li key={i} className="anc-rel-item">
                  <span
                    className="anc-rel-dot"
                    style={{ background: NODE_COLORS[item.neighbor.type] || '#94a3b8' }}
                  />
                  <span className="anc-rel-type">
                    {REL_LABELS[item.relType] || item.relType}
                  </span>
                  <span className="anc-rel-label" title={item.neighbor.label}>
                    {item.neighbor.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ── 3) Similitud ── */}
        <Section title="Similitud con artículos" icon="fa-chart-bar">
          {simLoading ? (
            <div className="anc-loading"><i className="fas fa-circle-notch fa-spin" /></div>
          ) : simResults.length === 0 ? (
            <p className="anc-empty">
              Sin resultados. Usa el panel de Similitud para calcular embeddings primero.
            </p>
          ) : (
            <ul className="anc-sim-list">
              {simResults.map((r, i) => {
                const pct   = Math.max(0, Math.min(1, r.similarity_score))
                const color = pct >= 0.9 ? '#10b981'
                            : pct >= 0.7 ? '#6366f1'
                            : pct >= 0.5 ? '#f59e0b'
                            : '#94a3b8'
                return (
                  <li key={i} className="anc-sim-item">
                    <div className="anc-sim-top">
                      <span className="anc-sim-rank">#{i + 1}</span>
                      <span className="anc-sim-title" title={r.label}>{r.label}</span>
                      <span className="anc-sim-score" style={{ color }}>
                        {(pct * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="anc-sim-bar-bg">
                      <div
                        className="anc-sim-bar-fill"
                        style={{ width: `${pct * 100}%`, background: color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

      </div>
    </div>
  )
}
