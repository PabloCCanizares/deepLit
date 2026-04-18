import { apiFetch } from './client.js'

export const statsAPI = {
  getStats: async ({ collection_id }) => {
    let url = '/stats/dashboard'
    if (collection_id) {
      url += `?collection_id=${collection_id}`
    }
    return apiFetch(url)
  },
}
