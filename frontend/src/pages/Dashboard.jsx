import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsAPI, openalexAPI } from '../api/index.js'
import StatCard from '../components/dashboard/StatCard'
import YearChart from '../components/dashboard/YearChart'
import KeywordRanking from '../components/dashboard/KeywordRanking'
import TypePieChart from '../components/dashboard/TypePieChart'
import CategoryBubbles from '../components/dashboard/CategoryBubbles'
import AuthorsChart from '../components/dashboard/AuthorsChart'
import '../styles/App.css'
import '../styles/dashboard/Dashboard.css'
import { useCollection } from '../context/CollectionContext'
import { getViewedHistory } from '../utils/viewHistory'

const OPENALEX_RECOMMENDATION_QUERIES = [
  { sort_by: 'cited_by_count-desc', filters: {} },
  { sort_by: 'year-desc', filters: {} },
  { sort_by: undefined, filters: {} },
]

function Dashboard() {
  const navigate = useNavigate()
  const { selectedCollectionId } = useCollection()

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activityMode, setActivityMode] = useState('recent')
  const [activityItems, setActivityItems] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [selectedCollectionId])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await statsAPI.getStats({
        collection_id: selectedCollectionId || undefined,
      })
      if (!response?.success) {
        setStats({
          document_count: 0,
          article_count: 0,
          labels_by_year: [],
          values_by_year: [],
          sorted_keywords: [],
        })
        setError(response?.message || 'No se pudieron cargar las estadisticas')
        return
      }

      setStats(response.data || {})
      loadActivityPanel()
    } catch (err) {
      setError(err.status ? err.message : 'Error de conexion con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const loadActivityPanel = async () => {
    setActivityLoading(true)

    try {
      const recentHistory = getViewedHistory('private').slice(0, 5)
      const recentArticles = recentHistory.map((item) => ({
        id: item.id,
        source: item.source || 'article',
        title: item.title || 'Sin titulo',
        meta: `Año: ${item.year || 'No especificado'} - Categoria: ${item.category || 'No especificada'}`,
        secondary: 'Visto recientemente',
      }))

      if (recentArticles.length > 0) {
        setActivityMode('recent')
        setActivityItems(recentArticles)
        return
      }

      let recommendedWorks = []

      for (const query of OPENALEX_RECOMMENDATION_QUERIES) {
        try {
          const recommendedResponse = await openalexAPI.getWorks({
            limit: 5,
            offset: 0,
            filters: query.filters,
            sort_by: query.sort_by,
          })

          recommendedWorks = (recommendedResponse?.data?.articles || []).map((work) => ({
            id: work._id || work.id,
            source: 'openalex',
            title: work.title || 'Sin titulo',
            meta: `Año: ${work.year || 'No especificado'} - Categoria: ${work.category || 'No especificada'}`,
            secondary: 'Top relevancia OpenAlex',
          }))

          if (recommendedWorks.length > 0) {
            break
          }
        } catch (queryError) {
          console.warn('Consulta OpenAlex sin resultados, probando fallback:', queryError)
        }
      }

      if (recommendedWorks.length > 0) {
        setActivityMode('recommended')
        setActivityItems(recommendedWorks)
        return
      }

      setActivityMode('empty')
      setActivityItems([])
    } catch (err) {
      console.error('Error cargando panel de actividad/recomendados:', err)
      setActivityMode('empty')
      setActivityItems([])
    } finally {
      setActivityLoading(false)
    }
  }

  const handleFilterClick = () => {
    // Placeholder: filtro por implementar
  }

  const handleActivityClick = (item) => {
    if (!item?.id) return

    if ((item.source || 'article') === 'article') {
      navigate(`/articles/${encodeURIComponent(item.id)}`, { state: { from: 'dashboard' } })
      return
    }

    navigate(`/openalex/${encodeURIComponent(item.id)}`, { state: { from: 'dashboard' } })
  }

  const handleActivityKeyDown = (event, item) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleActivityClick(item)
    }
  }

  if (loading) {
    return (
      <div className="dashboardContainer">
        <div className="loading-container">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--main_color)' }}></i>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboardContainer">
        <div className="error-container">
          <i className="fas fa-exclamation-circle fa-3x"></i>
          <p>Error: {error}</p>
          <button onClick={loadDashboard} className="btn-primary">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboardContainer">
      <div className="header">
        <h1 className="dashboard-main-title">Panel de Control</h1>
        <button onClick={handleFilterClick} className="btn-primary">
          <i className="fas fa-filter"></i>
          Filtrar
        </button>
      </div>

      <div className="statsGrid">
        <StatCard title="Articulos Subidos" value={stats?.document_count || 0} icon="fa-book" />
        <StatCard title="Articulos Guardados" value={stats?.article_count || 0} icon="fa-quote-right" />
        <StatCard title="Referencias por Articulo" value={stats?.avg_references || 0} icon="fa-chart-line" />
      </div>

      <div className="sectionRow">
        <div className="section sectionInRow">
          <h3 className="sectionTitle">Distribución por Tipo</h3>
          <TypePieChart data={stats?.type_distribution || []} />
        </div>

        <div className="section sectionInRow">
          <h3 className="sectionTitle">{activityMode === 'recent' ? 'Recientes' : 'Articulos recomendados'}</h3>

          {activityLoading ? (
            <div className="recentDocsLoading">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Cargando...</span>
            </div>
          ) : activityItems.length > 0 ? (
            <ul className="recentDocsList">
              {activityItems.map((item) => (
                <li
                  key={item.id}
                  className="recentDocItem recentDocItemInteractive"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleActivityClick(item)}
                  onKeyDown={(event) => handleActivityKeyDown(event, item)}
                >
                  <div className="recentDocTitle">{item.title}</div>
                  <div className="recentDocDate">{item.meta}</div>
                  <div className="recentDocHint">{item.secondary}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="recentDocsEmpty">No hay articulos recomendados disponibles.</p>
          )}
        </div>
      </div>

      <div className="sectionRow">
        <div className="section sectionInRow">
          <h3 className="sectionTitle">Ranking de Keywords</h3>
          <KeywordRanking keywords={stats?.sorted_keywords?.slice(0, 30) || []} />
        </div>

        <div className="section sectionInRow">
          <h3 className="sectionTitle">Distribución por Categoría</h3>
          <CategoryBubbles data={stats?.category_distribution || []} />
        </div>
      </div>

      <div className="sectionRow">
        <div className="section sectionInRow">
          <h3 className="sectionTitle">Top Autores</h3>
          <AuthorsChart data={stats?.authors_ranking || []} />
        </div>

        <div className="section sectionInRow">
          <h3 className="sectionTitle">Artículos por Año</h3>
          <YearChart labels={stats?.labels_by_year || []} values={stats?.values_by_year || []} />
        </div>
      </div>

      {(stats?.notif_abstract > 0 || stats?.notif_keywords > 0) && (
        <div className="notification">
          <i className="fas fa-exclamation-triangle"></i>
          <span>
            Se encontraron {stats.notif_abstract} articulos sin abstract y {stats.notif_keywords} sin keywords.
          </span>
        </div>
      )}
    </div>
  )
}

export default Dashboard
