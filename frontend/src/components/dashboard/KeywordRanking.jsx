import '../../styles/dashboard/KeywordRanking.css'

const hashText = (text) => {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function KeywordRanking({ keywords }) {
  if (!keywords || keywords.length === 0) {
    return <p className="text-muted">No hay keywords disponibles</p>
  }

  // keywords es un array de tuplas [palabra, frecuencia]
  // Encontrar el máximo count para normalizar los tamaños
  const maxCount = Math.max(...keywords.map(k => k[1]))
  const minCount = Math.min(...keywords.map(k => k[1]))

  // Generar colores variados
  const colors = [
    '#6366f1', // main_color
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // orange
    '#10b981', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#f43f5e', // red
  ]

  // Calcular tamaño de fuente basado en el count (entre 12px y 48px)
  const getFontSize = (count) => {
    if (maxCount === minCount) return 24
    const normalized = (count - minCount) / (maxCount - minCount)
    return 12 + normalized * 36 // De 12px a 48px
  }

  const shuffledKeywords = [...keywords].sort((a, b) => hashText(a[0]) - hashText(b[0]))

  return (
    <div className="keyword-cloud">
      {shuffledKeywords.map(([word, freq], index) => {
        const seed = hashText(`${word}-${freq}`)
        const rotate = (seed % 13) - 6
        const shiftX = (seed % 13) - 6
        const shiftY = ((Math.floor(seed / 5)) % 13) - 6

        return (
          <div
            key={index}
            className="keyword-cloud-item"
            style={{
              fontSize: `${getFontSize(freq)}px`,
              color: colors[index % colors.length],
              transform: `translate(${shiftX}px, ${shiftY}px) rotate(${rotate}deg)`,
            }}
            title={`${word}: ${freq} apariciones`}
          >
            {word}
          </div>
        )
      })}
    </div>
  )
}

export default KeywordRanking


