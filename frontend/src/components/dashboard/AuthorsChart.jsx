import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function AuthorsChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-muted">No hay datos de autores disponibles</p>
  }

  const chartData = {
    labels: data.map(([name]) => name),
    datasets: [
      {
        label: 'Artículos',
        data: data.map(([, count]) => count),
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
      },
      x: {
        ticks: {
          font: { size: 11 },
          maxRotation: 60,
          minRotation: 45,
        },
      },
    },
  }

  const dynamicHeight = Math.max(320, Math.min(520, 280 + data.length * 10))

  return (
    <div className="chart-container" style={{ height: `${dynamicHeight}px` }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default AuthorsChart
