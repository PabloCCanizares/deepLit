import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import ArticleGraph from '../components/dashboard/ArticleGraph'
import { articleGraphAPI } from '../api/index.js'
import '../styles/App.css'

function KnowledgeGraph() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { isFetching, refetch } = useQuery({
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

  return (
    <div className="dashboardContainer knowledge-graph-page">
      <div className="header">
        <h1 className="dashboard-main-title">Grafo de Conocimiento</h1>
        <button
          type="button"
          className="btn-primary article-graph__refresh"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <i className={`fas fa-sync-alt ${isFetching ? 'fa-spin' : ''}`}></i>
          {isFetching ? 'Actualizando' : 'Actualizar'}
        </button>
      </div>
      <div className="section">
        <ArticleGraph />
      </div>
    </div>
  )
}

export default KnowledgeGraph
