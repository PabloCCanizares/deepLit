import '../../styles/dashboard/CategoryBubbles.css'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#f43f5e',
  '#a855f7', '#22c55e',
]

const hashText = (text) => {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function CategoryBubbles({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-muted">No hay datos de categoría disponibles</p>
  }

  const maxCount = Math.max(...data.map(([, c]) => c))
  const minCount = Math.min(...data.map(([, c]) => c))

  const getSize = (count) => {
    if (maxCount === minCount) return 64
    const normalized = (count - minCount) / (maxCount - minCount)
    return 88 + normalized * 74
  }

  const getFontSize = (count) => {
    if (maxCount === minCount) return 14
    const normalized = (count - minCount) / (maxCount - minCount)
    return 12 + normalized * 7
  }

  const shuffledData = [...data].sort((a, b) => hashText(a[0]) - hashText(b[0]))

  return (
    <div className="category-bubbles">
      {shuffledData.map(([label, count], index) => {
        const frequencySize = getSize(count)
        const minSizeForText = Math.max(88, (label.length * 8) + 30)
        const size = Math.min(190, Math.max(frequencySize, minSizeForText))
        const seed = hashText(`${label}-${count}`)
        const rotate = (seed % 9) - 4
        const shiftX = (seed % 11) - 5
        const shiftY = ((Math.floor(seed / 7)) % 11) - 5
        return (
          <div
            key={index}
            className="category-bubble"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: COLORS[index % COLORS.length],
              fontSize: `${getFontSize(count)}px`,
              transform: `translate(${shiftX}px, ${shiftY}px) rotate(${rotate}deg)`,
            }}
            title={`${label}: ${count} artículos`}
          >
            <span className="category-bubble-label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default CategoryBubbles
