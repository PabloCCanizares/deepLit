import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Pie } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = [
  'rgba(99, 102, 241, 0.8)',
  'rgba(139, 92, 246, 0.8)',
  'rgba(236, 72, 153, 0.8)',
  'rgba(245, 158, 11, 0.8)',
  'rgba(16, 185, 129, 0.8)',
  'rgba(6, 182, 212, 0.8)',
  'rgba(59, 130, 246, 0.8)',
  'rgba(244, 63, 94, 0.8)',
  'rgba(168, 85, 247, 0.8)',
  'rgba(34, 197, 94, 0.8)',
]

const BORDER_COLORS = COLORS.map(c => c.replace('0.8)', '1)'))

function TypePieChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-muted">No hay datos de tipo disponibles</p>
  }

  const chartData = {
    labels: data.map(([label]) => label),
    datasets: [
      {
        data: data.map(([, count]) => count),
        backgroundColor: COLORS.slice(0, data.length),
        borderColor: BORDER_COLORS.slice(0, data.length),
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((s, v) => s + v, 0)
            const pct = ((context.parsed / total) * 100).toFixed(1)
            return ` ${context.label}: ${context.parsed} (${pct}%)`
          },
        },
      },
    },
  }

  return (
    <div className="chart-container" style={{ height: '320px' }}>
      <Pie data={chartData} options={options} />
    </div>
  )
}

export default TypePieChart
