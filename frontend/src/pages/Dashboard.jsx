import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsAPI, uploadAPI, openalexAPI } from '../api/api'
import StatCard from '../components/dashboard/StatCard'
import YearChart from '../components/dashboard/YearChart'
import KeywordRanking from '../components/dashboard/KeywordRanking'
import '../styles/App.css'
import '../styles/dashboard/Dashboard.css'
import { useCollection } from '../context/CollectionContext'
import { getViewedHistory } from '../utils/viewHistory'

const OPENALEX_RECOMMENDATION_QUERIES = [
  { sort_by: 'relevance-desc', filters: { mode: 'all' } },
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
  const [uploading, setUploading] = useState(false)

  const [activityMode, setActivityMode] = useState('recent')
  const [activityItems, setActivityItems] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  const fileInputRef = useRef(null)

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

  const handleUploadClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF')
      return
    }

    try {
      setUploading(true)
      await uploadAPI.uploadPDF(file)
      alert('PDF subido correctamente')
      loadDashboard()
    } catch (err) {
      alert(err.status ? err.message : 'Error de conexion con el servidor')
    } finally {
      setUploading(false)
      fileInputRef.current.value = ''
    }
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
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button onClick={handleUploadClick} disabled={uploading} className="btn-primary">
            <i className={uploading ? 'fas fa-spinner fa-spin' : 'fas fa-upload'}></i>
            {uploading ? 'Subiendo...' : 'Subir PDF'}
          </button>
        </div>
      </div>

      <div className="statsGrid">
        <StatCard title="Articulos Subidos" value={stats?.document_count || 0} icon="fa-book" />
        <StatCard title="Articulos Guardados" value={stats?.article_count || 0} icon="fa-quote-right" />
        <StatCard title="Referencias por Articulo" value={stats?.avg_references || 0} icon="fa-chart-line" />
      </div>

      <div className="gridLayout">
        <div>
          <div className="section">
            <h3 className="sectionTitle">Articulos por Año</h3>
            <YearChart labels={stats?.labels_by_year || []} values={stats?.values_by_year || []} />
          </div>

          <div className="section">
            <h3 className="sectionTitle">Ranking de Keywords</h3>
            <KeywordRanking keywords={stats?.sorted_keywords?.slice(0, 10) || []} />
          </div>
        </div>

        <div>
          {stats?.wordcloud_img && (
            <div className="section">
              <h3 className="sectionTitle">WordCloud de Keywords</h3>
              <div className="wordcloudContainer">
                <img
                  src={`data:image/png;base64,${stats.wordcloud_img}`}
                  alt="Wordcloud de Keywords"
                  className="wordcloudImg"
                />
              </div>
            </div>
          )}

          <div className="section">
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
