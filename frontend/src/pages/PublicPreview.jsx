import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePagination } from '../hooks/usePagination'

import StatCard from '../components/dashboard/StatCard'
import YearChart from '../components/dashboard/YearChart'
import KeywordRanking from '../components/dashboard/KeywordRanking'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import FilterSortControls from '../components/articles/FilterSortControls'
import ArticleList from '../components/articles/ArticleList'
import ArticleGrid from '../components/articles/ArticleGrid'
import OpenAlexList from '../components/openalex/OpenAlexList'
import OpenAlexGrid from '../components/openalex/OpenAlexGrid'
import Pagination from '../components/articles/Pagination'
import AiAssistant from '../components/ai_assistant/AiAssistant'

const DASHBOARD_DATA = {
  document_count: 126,
  article_count: 842,
  avg_references: 6.7,
  labels_by_year: ['2021', '2022', '2023', '2024', '2025'],
  values_by_year: [14, 18, 26, 31, 37],
  sorted_keywords: [
    ['machine learning', 42],
    ['knowledge graph', 35],
    ['citation network', 27],
    ['review automation', 19],
    ['information retrieval', 16],
  ],
  recent_docs: [
    { title: 'Knowledge Graphs for Scientific Discovery', upload_date: '2026-02-15' },
    { title: 'Reproducible Workflows in Literature Reviews', upload_date: '2026-02-14' },
    { title: 'Automating Citation Screening with LLMs', upload_date: '2026-02-12' },
  ],
}

const PREVIEW_ARTICLES = [
  {
    id: 'seed-001',
    title: 'Knowledge Graphs for Scientific Discovery',
    category: 'IA aplicada',
    pages: 16,
    year: 2024,
    authors: 'L. Moretti, A. Singh',
  },
  {
    id: 'seed-002',
    title: 'Reproducible Workflows in Literature Reviews',
    category: 'Metodologia',
    pages: 12,
    year: 2023,
    authors: 'M. Ortega, S. Lin',
  },
  {
    id: 'seed-003',
    title: 'Automating Citation Screening with LLMs',
    category: 'Procesamiento de texto',
    pages: 21,
    year: 2025,
    authors: 'P. Ivanov, N. Reyes',
  },
  {
    id: 'seed-004',
    title: 'OpenAlex Signals for Topic Evolution',
    category: 'Bibliometria',
    pages: 9,
    year: 2022,
    authors: 'E. Kwon',
  },
  {
    id: 'seed-005',
    title: 'Systematic Review Quality in Fast-Moving Fields',
    category: '',
    pages: 14,
    year: 2021,
    authors: 'J. Kim',
  },
  {
    id: 'seed-006',
    title: 'Agentic Pipelines for Literature Mapping',
    category: 'Automatizacion',
    pages: 0,
    year: null,
    authors: 'A. Duarte',
  },
]

const PREVIEW_OPENALEX = [
  {
    id: 'W44001001',
    title: 'Self-Supervised Learning in Biomedical Corpora',
    category: 'Machine learning',
    year: 2025,
  },
  {
    id: 'W44001002',
    title: 'When Retrieval Meets Research Agents',
    category: 'Information retrieval',
    year: 2024,
  },
  {
    id: 'W44001003',
    title: 'Bias Auditing in Citation Networks',
    category: 'Bibliometria',
    year: 2023,
  },
  {
    id: 'W44001004',
    title: 'Explainable Ranking for Screening Support',
    category: '',
    year: 2022,
  },
]

const LOCK_MESSAGES = {
  upload: 'Subir archivos se habilita al iniciar sesion.',
  edit: 'Editar articulos se habilita al iniciar sesion.',
  collections: 'Guardar en colecciones se habilita al iniciar sesion.',
  workspace: 'Zona de Trabajo se habilita al iniciar sesion.',
  profile: 'Perfil se habilita al iniciar sesion.',
  settings: 'Ajustes se habilitan al iniciar sesion.',
  openalex: 'Guardar resultados de OpenAlex se habilita al iniciar sesion.',
}

function sortByCriteria(items, criteria) {
  const sorted = [...items]

  switch (criteria) {
    case 'year-asc':
      sorted.sort((a, b) => (a.year || 0) - (b.year || 0))
      break
    case 'year-desc':
      sorted.sort((a, b) => (b.year || 0) - (a.year || 0))
      break
    case 'title-asc':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      break
    case 'title-desc':
      sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
      break
    default:
      break
  }

  return sorted
}

function isCompleteItem(item) {
  return Boolean(item.title && item.category && item.year)
}

function PublicPreview() {
  const { isAuthenticated } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [lockMessage, setLockMessage] = useState('')

  const [articleQuery, setArticleQuery] = useState('')
  const [articleSort, setArticleSort] = useState('year-desc')
  const [articleFilter, setArticleFilter] = useState({ mode: 'all' })
  const [articleViewMode, setArticleViewMode] = useState('list')
  const [selectedArticles, setSelectedArticles] = useState([])
  const [articlePagination, setArticlePagination] = useState({ limit: 10, offset: 0, total: PREVIEW_ARTICLES.length })

  const [openAlexQuery, setOpenAlexQuery] = useState('')
  const [openAlexSort, setOpenAlexSort] = useState('year-desc')
  const [openAlexFilter, setOpenAlexFilter] = useState({ mode: 'all' })
  const [openAlexViewMode, setOpenAlexViewMode] = useState('list')
  const [selectedOpenAlex, setSelectedOpenAlex] = useState([])
  const [openAlexPagination, setOpenAlexPagination] = useState({ limit: 10, offset: 0, total: PREVIEW_OPENALEX.length })

  const {
    currentPage: articleCurrentPage,
    totalPages: articleTotalPages,
    setPage: setArticlePage,
    nextPage: nextArticlePage,
    prevPage: prevArticlePage,
    setLimit: setArticleLimit,
  } = usePagination(articlePagination, setArticlePagination)

  const {
    currentPage: openAlexCurrentPage,
    totalPages: openAlexTotalPages,
    setPage: setOpenAlexPage,
    nextPage: nextOpenAlexPage,
    prevPage: prevOpenAlexPage,
    setLimit: setOpenAlexLimit,
  } = usePagination(openAlexPagination, setOpenAlexPagination)

  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/preview/openalex')) {
      setActiveSection('openalex')
      return
    }
    if (path.startsWith('/preview/articles')) {
      setActiveSection('articles')
      return
    }
    setActiveSection('dashboard')
  }, [location.pathname])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
        setLockMessage('')
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const filteredArticles = useMemo(() => {
    const query = articleQuery.trim().toLowerCase()

    const filtered = PREVIEW_ARTICLES.filter((article) => {
      const searchable = [article.title, article.authors, article.category].join(' ').toLowerCase()
      const matchesQuery = !query || searchable.includes(query)

      if (!matchesQuery) {
        return false
      }

      if (articleFilter.mode === 'complete') {
        return isCompleteItem(article)
      }

      if (articleFilter.mode === 'incomplete') {
        return !isCompleteItem(article)
      }

      return true
    })

    return sortByCriteria(filtered, articleSort)
  }, [articleFilter, articleQuery, articleSort])

  const paginatedArticles = useMemo(() => {
    const start = articlePagination.offset
    const end = start + articlePagination.limit
    return filteredArticles.slice(start, end)
  }, [articlePagination.limit, articlePagination.offset, filteredArticles])

  const filteredOpenAlex = useMemo(() => {
    const query = openAlexQuery.trim().toLowerCase()

    const filtered = PREVIEW_OPENALEX.filter((work) => {
      const searchable = [work.title, work.category, work.id].join(' ').toLowerCase()
      const matchesQuery = !query || searchable.includes(query)

      if (!matchesQuery) {
        return false
      }

      if (openAlexFilter.mode === 'complete') {
        return isCompleteItem(work)
      }

      if (openAlexFilter.mode === 'incomplete') {
        return !isCompleteItem(work)
      }

      return true
    })

    return sortByCriteria(filtered, openAlexSort)
  }, [openAlexFilter, openAlexQuery, openAlexSort])

  const paginatedOpenAlex = useMemo(() => {
    const start = openAlexPagination.offset
    const end = start + openAlexPagination.limit
    return filteredOpenAlex.slice(start, end)
  }, [filteredOpenAlex, openAlexPagination.limit, openAlexPagination.offset])

  useEffect(() => {
    setArticlePagination((prev) => ({ ...prev, total: filteredArticles.length }))
  }, [filteredArticles.length])

  useEffect(() => {
    setOpenAlexPagination((prev) => ({ ...prev, total: filteredOpenAlex.length }))
  }, [filteredOpenAlex.length])

  useEffect(() => {
    setSelectedArticles([])
  }, [articlePagination.offset])

  useEffect(() => {
    setSelectedOpenAlex([])
  }, [openAlexPagination.offset])

  const openLock = (key) => {
    setLockMessage(LOCK_MESSAGES[key] || 'Esta accion requiere iniciar sesion.')
  }

  const handleBlockedNav = (reason) => (event) => {
    event.preventDefault()
    setSidebarOpen(false)
    openLock(reason)
  }

  const handleArticleSearch = (query) => {
    setArticleQuery(query)
    setArticlePagination((prev) => ({ ...prev, offset: 0 }))
  }

  const handleArticleSort = (criteria) => {
    setArticleSort(criteria)
    setArticlePagination((prev) => ({ ...prev, offset: 0 }))
  }

  const handleArticleFilter = (filter) => {
    setArticleFilter(filter)
    setArticlePagination((prev) => ({ ...prev, offset: 0 }))
  }

  const handleOpenAlexSearch = (query) => {
    setOpenAlexQuery(query)
    setOpenAlexPagination((prev) => ({ ...prev, offset: 0 }))
  }

  const handleOpenAlexSort = (criteria) => {
    setOpenAlexSort(criteria)
    setOpenAlexPagination((prev) => ({ ...prev, offset: 0 }))
  }

  const handleOpenAlexFilter = (filter) => {
    setOpenAlexFilter(filter)
    setOpenAlexPagination((prev) => ({ ...prev, offset: 0 }))
  }

  const handleSelectArticle = (articleId) => {
    setSelectedArticles((prev) => (prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]))
  }

  const handleSelectAllArticles = () => {
    const ids = paginatedArticles.map((article) => article.id)
    const allSelected = ids.length > 0 && ids.every((id) => selectedArticles.includes(id))
    setSelectedArticles(allSelected ? [] : ids)
  }

  const handleSelectOpenAlex = (articleId) => {
    setSelectedOpenAlex((prev) => (prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]))
  }

  const handleSelectAllOpenAlex = () => {
    const ids = paginatedOpenAlex.map((work) => work.id)
    const allSelected = ids.length > 0 && ids.every((id) => selectedOpenAlex.includes(id))
    setSelectedOpenAlex(allSelected ? [] : ids)
  }

  const renderDashboard = () => {
    return (
      <div className="dashboardContainer">
        <div className="header">
          <h1 className="dashboard-main-title">Panel de Control</h1>
          <div className="previewHeaderActions">
            <button className="btn-primary" onClick={() => openLock('upload')}>
              <i className="fas fa-upload"></i>
              Subir PDF
            </button>
          </div>
        </div>

        <div className="statsGrid">
          <StatCard title="Articulos Subidos" value={DASHBOARD_DATA.document_count} icon="fa-book" />
          <StatCard title="Articulos Guardados" value={DASHBOARD_DATA.article_count} icon="fa-quote-right" />
          <StatCard title="Referencias por Articulo" value={DASHBOARD_DATA.avg_references} icon="fa-chart-line" />
        </div>

        <div className="gridLayout">
          <div>
            <div className="section">
              <h3 className="sectionTitle">Articulos por Ano</h3>
              <YearChart labels={DASHBOARD_DATA.labels_by_year} values={DASHBOARD_DATA.values_by_year} />
            </div>

            <div className="section">
              <h3 className="sectionTitle">Ranking de Keywords</h3>
              <KeywordRanking keywords={DASHBOARD_DATA.sorted_keywords} />
            </div>
          </div>

          <div>
            <div className="section">
              <h3 className="sectionTitle">Actividad Reciente</h3>
              <ul className="recentDocsList">
                {DASHBOARD_DATA.recent_docs.map((doc, index) => (
                  <li key={`${doc.title}-${index}`} className="recentDocItem">
                    <div className="recentDocTitle">{doc.title}</div>
                    <div className="recentDocDate">Subido: {doc.upload_date}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="notification">
          <i className="fas fa-lock"></i>
          <span>Subida, edicion, colecciones y IA se habilitan al iniciar sesion.</span>
        </div>
      </div>
    )
  }

  const renderArticles = () => {
    return (
      <div className="page-container">
        <div className="container">
          <div className="header-panel">
            <div className="header-content">
              <div className="header-info">
                <h1 className="header-title">Todos Mis Articulos</h1>
                <span className="header-subtitle">Gestiona y organiza tu biblioteca de articulos</span>
              </div>
              <div className="header-stats">
                <div className="stat-item">
                  <span className="stat-number">{paginatedArticles.length}</span>
                  <span className="stat-label">Filtrados</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                  <span className="stat-number">{filteredArticles.length}</span>
                  <span className="stat-label">Total</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <SearchBarDebounced onSearch={handleArticleSearch} placeholder="Buscar por titulo" />
          </div>

          <FilterSortControls
            onSort={handleArticleSort}
            onFilter={handleArticleFilter}
            viewMode={articleViewMode}
            onViewModeChange={setArticleViewMode}
            currentLimit={articlePagination.limit}
            onLimitChange={setArticleLimit}
          />

          {articleViewMode === 'list' ? (
            <ArticleList
              documents={paginatedArticles}
              loading={false}
              error={null}
              baseRoute="/preview/articles"
              selectedArticles={selectedArticles}
              onSelectArticle={handleSelectArticle}
              onSelectAll={handleSelectAllArticles}
              onAddToCollectionsSingle={() => openLock('collections')}
              onDeleteArticle={() => openLock('edit')}
            />
          ) : (
            <ArticleGrid
              documents={paginatedArticles}
              loading={false}
              error={null}
              baseRoute="/preview/articles"
              selectedArticles={selectedArticles}
              onSelectArticle={handleSelectArticle}
              onAddToCollectionsSingle={() => openLock('collections')}
              onDeleteArticle={() => openLock('edit')}
            />
          )}

          <Pagination
            currentPage={articleCurrentPage}
            totalPages={articleTotalPages}
            onPrev={prevArticlePage}
            onNext={nextArticlePage}
            onPageChange={setArticlePage}
          />

          <button className="floating-upload-button" onClick={() => openLock('upload')}>
            <i className="fas fa-cloud-upload-alt"></i>
          </button>
        </div>
      </div>
    )
  }

  const renderOpenAlex = () => {
    return (
      <div className="page-container">
        <div className="container">
          <SearchBarDebounced onSearch={handleOpenAlexSearch} placeholder="Buscar por titulo" />

          <FilterSortControls
            onSort={handleOpenAlexSort}
            onFilter={handleOpenAlexFilter}
            viewMode={openAlexViewMode}
            onViewModeChange={setOpenAlexViewMode}
            currentLimit={openAlexPagination.limit}
            onLimitChange={setOpenAlexLimit}
          />

          {openAlexViewMode === 'list' ? (
            <OpenAlexList
              documents={paginatedOpenAlex}
              loading={false}
              error={null}
              baseRoute="/preview/openalex"
              selectedArticles={selectedOpenAlex}
              onSelectArticle={handleSelectOpenAlex}
              onSelectAll={handleSelectAllOpenAlex}
              savedArticles={[]}
              onSave={async () => {
                openLock('openalex')
                return false
              }}
              onSaveMultiple={() => openLock('openalex')}
            />
          ) : (
            <OpenAlexGrid
              documents={paginatedOpenAlex}
              loading={false}
              error={null}
              baseRoute="/preview/openalex"
              selectedArticles={selectedOpenAlex}
              onSelectArticle={handleSelectOpenAlex}
              savedArticles={[]}
              onSave={async () => {
                openLock('openalex')
                return false
              }}
              onSaveMultiple={() => openLock('openalex')}
            />
          )}

          <Pagination
            currentPage={openAlexCurrentPage}
            totalPages={openAlexTotalPages}
            onPrev={prevOpenAlexPage}
            onNext={nextOpenAlexPage}
            onPageChange={setOpenAlexPage}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-container previewAppShell">
      <nav className="navbar">
        <div className="navbarContainer">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="sidebarToggle" onClick={() => setSidebarOpen((open) => !open)} aria-label="Abrir menu">
              <i className="fas fa-bars"></i>
            </button>

            <Link to={isAuthenticated ? '/dashboard' : '/preview'} className="navbarBrand">
              <span className="deepLit-d">deep</span>
              <span className="deepLit-lit">Lit</span>
            </Link>
          </div>

          <div className="navbarMenu previewTopActions">
            <div className="collectionSelector previewDesktopOnly">
              <button className="collectionButton previewCollectionButton" disabled>
                <span>Coleccion por defecto</span>
                <i className="fas fa-lock"></i>
              </button>
            </div>

            <div className="themeToggle">
              <button
                className={`themeButton ${theme === 'light' ? 'active' : ''}`}
                onClick={() => theme !== 'light' && toggleTheme()}
                title="Modo claro"
              >
                <i className="fas fa-sun"></i>
              </button>
              <button
                className={`themeButton ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme !== 'dark' && toggleTheme()}
                title="Modo oscuro"
              >
                <i className="fas fa-moon"></i>
              </button>
            </div>

            <AiAssistant locked />

            {isAuthenticated ? (
              <Link to="/dashboard" className="previewTopAuth previewTopAuthPrimary">
                Ir a mi espacio
              </Link>
            ) : (
              <>
                <Link to="/login" className="previewTopAuth">
                  Iniciar sesion
                </Link>
                <Link to="/register" className="previewTopAuth previewTopAuthPrimary">
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className={`sidebarOverlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}></div>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebarHeader">
          <div className="deepLitLogo">
            <span className="deepLit-d">deep</span>
            <span className="deepLit-lit">Lit</span>
          </div>
        </div>

        <nav className="sidebarNav">
          <Link
            to="/preview"
            className={`sidebarLink ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <i className="fas fa-chart-line"></i>
            <span>Dashboard</span>
          </Link>

          <div className="sidebarGroup">
            <div className="sidebarGroupTitle">Articulos</div>
            <Link
              to="/preview/articles"
              className={`sidebarLink ${activeSection === 'articles' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <i className="fas fa-file-alt"></i>
              <span>Mis Articulos</span>
            </Link>
            <Link
              to="/preview/articles"
              className="sidebarLink"
              onClick={handleBlockedNav('collections')}
            >
              <i className="fas fa-folder"></i>
              <span>Colecciones</span>
            </Link>
          </div>

          <div className="sidebarGroup">
            <div className="sidebarGroupTitle">Trabajo y Analisis</div>
            <Link
              to="/preview/openalex"
              className="sidebarLink"
              onClick={handleBlockedNav('workspace')}
            >
              <i className="fas fa-briefcase"></i>
              <span>Zona de Trabajo</span>
            </Link>
            <Link
              to="/preview/openalex"
              className={`sidebarLink ${activeSection === 'openalex' ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <i className="fas fa-graduation-cap"></i>
              <span>OpenAlex</span>
            </Link>
          </div>
        </nav>

        <div className="sidebarFooter">
          <Link to="/preview" className="sidebarLink" onClick={handleBlockedNav('profile')}>
            <i className="fas fa-user"></i>
            <span>Perfil</span>
          </Link>
          <Link to="/preview" className="sidebarLink" onClick={handleBlockedNav('settings')}>
            <i className="fas fa-cog"></i>
            <span>Ajustes</span>
          </Link>
        </div>
      </aside>

      <main className="main-content">
        {activeSection === 'dashboard' && renderDashboard()}
        {activeSection === 'articles' && renderArticles()}
        {activeSection === 'openalex' && renderOpenAlex()}
      </main>

      {lockMessage && (
        <div className="modal-overlay" onClick={() => setLockMessage('')}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-lock" style={{ color: 'var(--color-danger)' }}></i>
                {' '}Accion no disponible
              </h2>
            </div>
            <div className="modal-body">
              <p>{lockMessage}</p>
            </div>
            <div className="modal-footer">
              <Link to="/register" className="btn-primary" onClick={() => setLockMessage('')}>
                Crear cuenta
              </Link>
              <Link to="/login" className="btn-secondary" onClick={() => setLockMessage('')}>
                Iniciar sesion
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PublicPreview
