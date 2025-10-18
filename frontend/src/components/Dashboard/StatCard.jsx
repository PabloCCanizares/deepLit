import '../../styles/App.css';

function StatCard({ title, value, icon }) {
  return (
    <div className="statCard">
      <div className="icon">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="content">
        <h2 className="value">{value}</h2>
        <p className="title">{title}</p>
      </div>
    </div>
  )
}

export default StatCard


