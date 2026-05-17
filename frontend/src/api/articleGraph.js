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

  getSimilar: async ({ node_label, node_id_prop, node_id_value, label_prop, min_similarity = 0, top_k = 50 } = {}) => {
    const params = new URLSearchParams({ node_label, node_id_prop, node_id_value, label_prop })
    params.set('min_similarity', String(min_similarity))
    params.set('top_k', String(top_k))
    return apiFetch(`/article-graph/similar?${params.toString()}`)
  },

  computeEmbeddings: async () => apiFetch('/article-graph/embeddings/compute', { method: 'POST' }),

  getEmbeddingStatus: async () => apiFetch('/article-graph/embeddings/status'),
}
