import { apiFetch } from './client.js'

export const redactionAPI = {
  createRun: async (collectionId, payload) => apiFetch(`/redaction/collections/${collectionId}/runs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  listRuns: async (collectionId) => apiFetch(`/redaction/collections/${collectionId}/runs`, {
    method: 'GET',
  }),

  getRun: async (runId) => apiFetch(`/redaction/runs/${runId}`, {
    method: 'GET',
  }),

  deleteRun: async (runId) => apiFetch(`/redaction/runs/${runId}`, {
    method: 'DELETE',
  }),
}
