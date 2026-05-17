import { apiFetch } from './client.js'

export const redactionAPI = {
  createRun: async (collectionId, payload) => apiFetch(`/redaction/collections/${collectionId}/runs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  listRuns: async (collectionId, { parent_run_id } = {}) => {
    const params = new URLSearchParams()
    if (parent_run_id) params.set('parent_run_id', parent_run_id)
    const query = params.toString()
    const path = `/redaction/collections/${collectionId}/runs${query ? `?${query}` : ''}`
    return apiFetch(path, {
      method: 'GET',
    })
  },

  getRun: async (runId) => apiFetch(`/redaction/runs/${runId}`, {
    method: 'GET',
  }),

  deleteRun: async (runId) => apiFetch(`/redaction/runs/${runId}`, {
    method: 'DELETE',
  }),
}
