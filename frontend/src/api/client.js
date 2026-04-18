const API_BASE = '/api'

function getAuthToken() {
  return localStorage.getItem('token')
}

async function apiFetch(endpoint, options = {}) {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = `${API_BASE}${normalizedEndpoint}`

  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const config = {
    headers,
    ...options,
  }

  try {
    const response = await fetch(url, config)

    if (response.status === 204) {
      return null
    }

    const data = await response.json()

    if (!response.ok) {
      const error = new Error(data.message)
      error.status = response.status
      error.data = data
      throw error
    }

    return data
  } catch (error) {
    console.error('API Error:', error)
    throw error
  }
}

async function fetchFile(endpoint) {
  const url = `${API_BASE}${endpoint}`
  const token = getAuthToken()
  const headers = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, { headers })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const error = new Error(`Error al cargar archivo: ${response.statusText}`)
      error.status = response.status
      throw error
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('File fetch error:', error)
    throw error
  }
}

export { API_BASE, getAuthToken, apiFetch, fetchFile }
