const PROCESSING_EVENT_STORAGE_KEY = 'deeplit.processingEventDedup.v1'
const PROCESSING_EVENT_TTL_MS = 1000 * 60 * 60 * 12

function getStorageSafe(storage) {
  if (storage) return storage

  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

function readCache(storage) {
  if (!storage) return {}

  try {
    const raw = storage.getItem(PROCESSING_EVENT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCache(storage, cache) {
  if (!storage) return

  try {
    storage.setItem(PROCESSING_EVENT_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Ignorar errores de almacenamiento para no romper la UI
  }
}

function buildProcessingEventKey(eventName, data = {}) {
  const articleId = data?._id || data?.id || 'unknown'
  const status = data?.status || eventName || 'unknown'
  const errorMessage = typeof data?.error_message === 'string'
    ? data.error_message.trim()
    : ''

  return [eventName || 'event', articleId, status, errorMessage].join('::')
}

function shouldDisplayProcessingEvent({
  eventName,
  data,
  storage,
  now = Date.now(),
  ttlMs = PROCESSING_EVENT_TTL_MS,
} = {}) {
  const safeStorage = getStorageSafe(storage)
  if (!safeStorage) return true

  const cache = readCache(safeStorage)
  const nextCache = {}

  Object.entries(cache).forEach(([key, timestamp]) => {
    if (typeof timestamp === 'number' && now - timestamp < ttlMs) {
      nextCache[key] = timestamp
    }
  })

  const eventKey = buildProcessingEventKey(eventName, data)
  const lastSeenAt = nextCache[eventKey]

  if (typeof lastSeenAt === 'number' && now - lastSeenAt < ttlMs) {
    writeCache(safeStorage, nextCache)
    return false
  }

  nextCache[eventKey] = now
  writeCache(safeStorage, nextCache)
  return true
}

export { buildProcessingEventKey, shouldDisplayProcessingEvent, PROCESSING_EVENT_TTL_MS }
