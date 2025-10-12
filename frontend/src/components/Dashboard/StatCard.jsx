function StatCard({ title, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="stat-content">
        <h2 className="stat-value">{value}</h2>
        <p className="stat-title">{title}</p>
      </div>
    </div>
  )
}

export default StatCard


