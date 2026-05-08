import { apiFetch } from './client.js'

export const articleGraphAPI = {
  getGraph: async ({ limit = 250 } = {}) => {
    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))

    const query = params.toString()
    const url = query ? `/article-graph/?${query}` : '/article-graph/'
    return apiFetch(url)
  },

  getStats: async () => apiFetch('/article-graph/stats'),
}
