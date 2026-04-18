import { apiFetch } from './client.js'

export const openalexAPI = {
  getWorks: async ({ limit = 10, offset = 0, filters = {}, sort_by } = {}) =>
    apiFetch('/openalex/search', {
      method: 'POST',
      body: JSON.stringify({
        pagination: { limit, offset },
        filters: Object.keys(filters).length > 0 ? filters : null,
        sort_by,
      }),
    }),

  getById: async (id) => apiFetch(`/openalex/${id}`, {
    method: 'GET',
  }),

  saveWork: async (id, collection_id) => {
    const url = collection_id
      ? `/openalex/${id}/save?collection_id=${collection_id}`
      : `/openalex/${id}/save`

    return apiFetch(url, { method: 'POST' })
  },

  unsaveWork: async (id, collection_id) => {
    const url = collection_id
      ? `/openalex/${id}/unsave?collection_id=${collection_id}`
      : `/openalex/${id}/unsave`

    return apiFetch(url, { method: 'POST' })
  },
}
