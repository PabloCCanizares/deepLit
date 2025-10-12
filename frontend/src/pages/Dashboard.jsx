import { useEffect, useState } from 'react'
import { statsAPI } from '../api/api'
import StatCard from '../components/Dashboard/StatCard'
import YearChart from '../components/Dashboard/YearChart'
import KeywordRanking from '../components/Dashboard/KeywordRanking'

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await statsAPI.getStats();
      setStats(data);
    } catch (err) {
      console.log('Dashboard error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          <p>Error: {error}</p>
          <button onClick={loadDashboard} className="btn-primary">Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-4">
      <h1 className="mb-4">Panel de Control</h1>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <StatCard 
          title="Documentos Subidos"
          value={stats?.total_documents || 0}
          icon="fa-book"
        />
        <StatCard 
          title="Referencias Totales"
          value={stats?.total_references || 0}
          icon="fa-quote-right"
        />
        <StatCard 
          title="Referencias por Documento"
          value={stats?.avg_references || 0}
          icon="fa-chart-line"
        />
      </div>

      {/* Year Chart */}
      <div className="section">
        <h3>Documentos por Año</h3>
        <YearChart 
          labels={stats?.chart_labels || []}
          values={stats?.chart_values || []}
        />
      </div>

      {/* Keywords Ranking */}
      <div className="section">
        <h3>Ranking de Keywords</h3>
        <KeywordRanking keywords={stats?.sorted_keywords?.slice(0, 10) || []} />
      </div>

      {/* WordCloud */}
      {stats?.wordcloud_img && (
        <div className="section">
          <h3>WordCloud de Keywords</h3>
          <div className="wordcloud-container">
            <img 
              src={`data:image/png;base64,${stats.wordcloud_img}`}
              alt="Wordcloud de Keywords"
              className="wordcloud-img"
            />
          </div>
        </div>
      )}

      {/* Recent Documents */}
      {stats?.recent_docs && stats.recent_docs.length > 0 && (
        <div className="section">
          <h3>Actividad Reciente</h3>
          <ul className="recent-docs-list">
            {stats.recent_docs.map((doc, index) => (
              <li key={index} className="recent-doc-item">
                <strong>{doc.title || doc.Title || 'Sin título'}</strong>
                <br />
                <small>Subido: {doc.upload_date}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notifications */}
      {(stats?.notif_abstract > 0 || stats?.notif_keywords > 0) && (
        <div className="alert alert-warning">
          <i className="fas fa-exclamation-triangle"></i>
          Se encontraron {stats.notif_abstract} documentos sin abstract y {stats.notif_keywords} sin keywords.
        </div>
      )}
    </div>
  )
}

export default Dashboard


