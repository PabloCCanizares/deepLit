import { useEffect, useState, useRef } from 'react'
import { statsAPI, uploadAPI } from '../api/api'
import StatCard from '../components/dashboard/StatCard'
import YearChart from '../components/dashboard/YearChart'
import KeywordRanking from '../components/dashboard/KeywordRanking'
import '../styles/App.css'
import '../styles/Dashboard/Dashboard.css'


function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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
      setError(err.status ? err.message : 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF');
      return;
    }

    try {
      setUploading(true);
      await uploadAPI.uploadPDF(file);
      alert('PDF subido correctamente');
      loadDashboard();
    } catch (err) {
      alert(err.status ? err.message : 'Error de conexión con el servidor');
    } finally {
      setUploading(false);
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="dashboardContainer">
        <div className="loadingContainer">
          <i className="fas fa-spinner fa-spin fa-3x"></i>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboardContainer">
        <div className="errorContainer">
          <i className="fas fa-exclamation-circle fa-3x"></i>
          <p>Error: {error}</p>
          <button onClick={loadDashboard} className="retryButton">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboardContainer">
      <div className="header">
        <h1 className="title">Panel de Control</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className="uploadButton"
          >
            <i className={uploading ? "fas fa-spinner fa-spin" : "fas fa-upload"}></i>
            {uploading ? 'Subiendo...' : 'Subir PDF'}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="statsGrid">
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

      <div className="gridLayout">
        <div>
          {/* Year Chart */}
          <div className="section">
            <h3 className="sectionTitle">Documentos por Año</h3>
            <YearChart 
              labels={stats?.chart_labels || []}
              values={stats?.chart_values || []}
            />
          </div>

          {/* Keywords Ranking */}
          <div className="section">
            <h3 className="sectionTitle">Ranking de Keywords</h3>
            <KeywordRanking keywords={stats?.sorted_keywords?.slice(0, 10) || []} />
          </div>
        </div>

        <div>
          {/* WordCloud */}
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

          {/* Recent Documents */}
          {stats?.recent_docs && stats.recent_docs.length > 0 && (
            <div className="section">
              <h3 className="sectionTitle">Actividad Reciente</h3>
              <ul className="recentDocsList">
                {stats.recent_docs.map((doc, index) => (
                  <li key={index} className="recentDocItem">
                    <div className="recentDocTitle">
                      {doc.title || doc.Title || 'Sin título'}
                    </div>
                    <div className="recentDocDate">
                      Subido: {doc.upload_date}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {(stats?.notif_abstract > 0 || stats?.notif_keywords > 0) && (
        <div className="notification">
          <i className="fas fa-exclamation-triangle"></i>
          <span>
            Se encontraron {stats.notif_abstract} documentos sin abstract y {stats.notif_keywords} sin keywords.
          </span>
        </div>
      )}
    </div>
  )
}

export default Dashboard


