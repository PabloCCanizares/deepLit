function KeywordRanking({ keywords }) {
  if (!keywords || keywords.length === 0) {
    return <p className="text-muted">No hay keywords disponibles</p>
  }

  return (
    <ul className="keyword-list">
      {keywords.map(([word, freq], index) => (
        <li key={index} className="keyword-item">
          <span className="keyword-word">{word}</span>
          <span className="keyword-badge">{freq}</span>
        </li>
      ))}
    </ul>
  )
}

export default KeywordRanking


