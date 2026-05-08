import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { statsAPI, openalexAPI } from '../api/index.js'
import { useArticlesEvents } from '../hooks/useArticlesEvents.js'
import StatCard from '../components/dashboard/StatCard'
import YearChart from '../components/dashboard/YearChart'
import KeywordRanking from '../components/dashboard/KeywordRanking'
import TypePieChart from '../components/dashboard/TypePieChart'
import CategoryBubbles from '../components/dashboard/CategoryBubbles'
import AuthorsChart from '../components/dashboard/AuthorsChart'
import ArticleGraph from '../components/dashboard/ArticleGraph'
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
  const queryClient = useQueryClient()

  const {
    data: stats,
    isLoading: loading,
    error,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboard-stats', selectedCollectionId || null],
    queryFn: async () => {
      const response = await statsAPI.getStats({
        collection_id: selectedCollectionId || undefined,
      })

      if (!response?.success) {
        throw new Error(response?.message || 'No se pudieron cargar las estadisticas')
      }

      return response.data || {}
    },
    staleTime:            0,
    refetchOnMount:       true,
    refetchOnWindowFocus: true,
  })

  // Actualización en tiempo real: cuando un artículo termina de procesarse (SSE),
  // invalida todas las queries del dashboard para reflejar los cambios al instante.
  useArticlesEvents({
    onArticleReady: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['article-graph'] })
    },
  })

  const {
    data: activityData,
    isLoading: activityLoading,
  } = useQuery({
    queryKey: ['dashboard-activity'],
    staleTime: 0,
    queryFn: async () => {
      const recentHistory = getViewedHistory('private').slice(0, 5)
      const recentArticles = recentHistory.map((item) => ({
        id: item.id,
        source: item.source || 'article',
        title: item.title || 'Sin titulo',
        meta: `Año: ${item.year || 'No especificado'} - Categoria: ${item.category || 'No especificada'}`,
        secondary: 'Visto recientemente',
      }))

      if (recentArticles.length > 0) {
        return {
          mode: 'recent',
          items: recentArticles,
        }
      }

      for (const query of OPENALEX_RECOMMENDATION_QUERIES) {
        try {
          const recommendedResponse = await openalexAPI.getWorks({
            limit: 5,
            offset: 0,
            filters: query.filters,
            sort_by: query.sort_by,
          })

          const recommendedWorks = (recommendedResponse?.data?.articles || []).map((work) => ({
            id: work._id || work.id,
            source: 'openalex',
            title: work.title || 'Sin titulo',
            meta: `Año: ${work.year || 'No especificado'} - Categoria: ${work.category || 'No especificada'}`,
            secondary: 'Top relevancia OpenAlex',
          }))

          if (recommendedWorks.length > 0) {
            return {
              mode: 'recommended',
              items: recommendedWorks,
            }
          }
        } catch (queryError) {
          console.warn('Consulta OpenAlex sin resultados, probando fallback:', queryError)
        }
      }

      return {
        mode: 'empty',
        items: [],
      }
    },
  })

  const activityMode = activityData?.mode || 'empty'
  const activityItems = activityData?.items || []

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
          <p>Error: {error.message || 'Error de conexion con el servidor'}</p>
          <button onClick={() => refetchStats()} className="btn-primary">
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

      <div className="section">
        <ArticleGraph />
      </div>
    </div>
  )
}

export default Dashboard
