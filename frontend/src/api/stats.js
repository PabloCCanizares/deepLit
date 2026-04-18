import { apiFetch } from './client.js'

export const statsAPI = {
  getStats: async ({ collection_id }) => {
    let url = '/stats/dashboard'
    console.log('1- statsAPI.getStats called with collection_id:', collection_id)
    if (collection_id) {
      url += `?collection_id=${collection_id}`
    }
    console.log('2- statsAPI.getStats called with collection_id:', url)
    console.log(url)
    return apiFetch(url)
  },
}
