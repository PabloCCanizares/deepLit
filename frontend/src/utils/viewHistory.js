const STORAGE_PREFIX = 'deeplit:view-history'
const DEFAULT_LIMIT = 50

function getStorageKey(scope = 'private') {
  return `${STORAGE_PREFIX}:${scope}`
}

function parseHistory(rawValue) {
  if (!rawValue) return []

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeHistory(items) {
  return items
    .filter((item) => item && item.id && item.source)
    .sort((a, b) => new Date(b.viewedAt || 0).getTime() - new Date(a.viewedAt || 0).getTime())
}

export function getViewedHistory(scope = 'private') {
  const raw = localStorage.getItem(getStorageKey(scope))
  return normalizeHistory(parseHistory(raw))
}

export function recordViewedItem(item, { scope = 'private', maxItems = DEFAULT_LIMIT } = {}) {
  if (!item || !item.id || !item.source) return

  const current = getViewedHistory(scope)
  const nextItem = {
    id: String(item.id),
    source: item.source,
    title: item.title || 'Sin titulo',
    year: item.year || null,
    category: item.category || '',
    viewedAt: new Date().toISOString(),
  }

  const deduped = current.filter((entry) => !(entry.id === nextItem.id && entry.source === nextItem.source))
  const merged = [nextItem, ...deduped].slice(0, maxItems)

  localStorage.setItem(getStorageKey(scope), JSON.stringify(merged))
}
