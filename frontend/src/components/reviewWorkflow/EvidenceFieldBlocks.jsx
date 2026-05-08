function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function normalizeSupportEntries(value) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      text: String(item.text || '').trim(),
      page: typeof item.page === 'number' ? item.page : null,
    }))
    .filter((item) => item.text)
}

export function FieldBlock({ label, children }) {
  return (
    <div className="evidence-field-block">
      <span className="evidence-field-label">{label}</span>
      <div className="evidence-field-content">{children}</div>
    </div>
  )
}

export function ListBlock({ label, items, kind = 'list' }) {
  const normalizedItems = normalizeList(items)
  if (normalizedItems.length === 0) return null

  return (
    <FieldBlock label={label}>
      {kind === 'chips' ? (
        <div className="evidence-chip-list">
          {normalizedItems.map((item, index) => (
            <span key={`${label}-${index}`} className="evidence-chip">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <ul className="evidence-bullet-list">
          {normalizedItems.map((item, index) => (
            <li key={`${label}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </FieldBlock>
  )
}

export function SupportBlock({ label, items }) {
  const entries = normalizeSupportEntries(items)
  if (entries.length === 0) return null

  return (
    <FieldBlock label={label}>
      <ul className="evidence-support-list">
        {entries.map((item, index) => (
          <li key={`${label}-${index}`} className="evidence-support-item">
            <span className="evidence-support-text">{item.text}</span>
            {item.page ? <span className="evidence-support-meta">p. {item.page}</span> : null}
          </li>
        ))}
      </ul>
    </FieldBlock>
  )
}
