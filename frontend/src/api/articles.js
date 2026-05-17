import { API_BASE, apiFetch, fetchFile, getAuthToken } from './client.js'

export const articlesAPI = {
  getArticles: async ({ limit = 10, offset = 0, filters = {}, collection_id, sort_by } = {}) => {
    const body = {
      pagination: { limit, offset },
      filters: Object.keys(filters).length > 0 ? filters : null,
      collection_id: collection_id || undefined,
      sort_by,
    }

    return apiFetch('/articles/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  getById: async (id) => apiFetch(`/articles/${id}`, {
    method: 'GET',
  }),

  getPdfUrl: async (id) => fetchFile(`/articles/${encodeURIComponent(id)}/pdf`),

  update: async (id, data) => apiFetch(`/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: async (id) => apiFetch(`/articles/${id}`, {
    method: 'DELETE',
  }),

  getQueue: async () => apiFetch('/articles/cola', {
    method: 'GET',
  }),

  getStatus: async (id) => apiFetch(`/articles/${id}/status`, {
    method: 'GET',
  }),

  subscribeEvents: ({
    onArticleReady,
    onArticleError,
    onScreeningReady,
    onScreeningError,
    onEvidenceExtractionReady,
    onEvidenceExtractionError,
    onCollectionSynthesisReady,
    onCollectionSynthesisError,
    onClusteringReady,
    onClusteringError,
    onRedactionReady,
    onRedactionError,
    onError,
  } = {}) => {
    const token = getAuthToken()
    const url = `${API_BASE}/articles/events?token=${encodeURIComponent(token || '')}`

    const eventSource = new EventSource(url)

    eventSource.addEventListener('article_ready', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onArticleReady) onArticleReady(data)
      } catch (err) {
        console.error('Error parsing article_ready event:', err)
      }
    })

    eventSource.addEventListener('article_error', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onArticleError) onArticleError(data)
      } catch (err) {
        console.error('Error parsing article_error event:', err)
      }
    })

    eventSource.addEventListener('screening_ready', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onScreeningReady) onScreeningReady(data)
      } catch (err) {
        console.error('Error parsing screening_ready event:', err)
      }
    })

    eventSource.addEventListener('screening_error', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onScreeningError) onScreeningError(data)
      } catch (err) {
        console.error('Error parsing screening_error event:', err)
      }
    })

    eventSource.addEventListener('evidence_extraction_ready', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onEvidenceExtractionReady) onEvidenceExtractionReady(data)
      } catch (err) {
        console.error('Error parsing evidence_extraction_ready event:', err)
      }
    })

    eventSource.addEventListener('evidence_extraction_error', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onEvidenceExtractionError) onEvidenceExtractionError(data)
      } catch (err) {
        console.error('Error parsing evidence_extraction_error event:', err)
      }
    })

    eventSource.addEventListener('collection_synthesis_ready', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onCollectionSynthesisReady) onCollectionSynthesisReady(data)
      } catch (err) {
        console.error('Error parsing collection_synthesis_ready event:', err)
      }
    })

    eventSource.addEventListener('collection_synthesis_error', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onCollectionSynthesisError) onCollectionSynthesisError(data)
      } catch (err) {
        console.error('Error parsing collection_synthesis_error event:', err)
      }
    })

    eventSource.addEventListener('clustering_ready', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onClusteringReady) onClusteringReady(data)
      } catch (err) {
        console.error('Error parsing clustering_ready event:', err)
      }
    })

    eventSource.addEventListener('clustering_error', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onClusteringError) onClusteringError(data)
      } catch (err) {
        console.error('Error parsing clustering_error event:', err)
      }
    })

    eventSource.addEventListener('redaction_ready', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onRedactionReady) onRedactionReady(data)
      } catch (err) {
        console.error('Error parsing redaction_ready event:', err)
      }
    })

    eventSource.addEventListener('redaction_error', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (onRedactionError) onRedactionError(data)
      } catch (err) {
        console.error('Error parsing redaction_error event:', err)
      }
    })

    eventSource.onerror = (event) => {
      if (onError) onError(event)
    }

    return eventSource
  },
}
