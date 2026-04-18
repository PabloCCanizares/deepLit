export function getErrorMessage(error, fallback = 'Ha ocurrido un error') {
  if (!error) return fallback

  if (typeof error === 'string') {
    return error.trim() || fallback
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallback
}
