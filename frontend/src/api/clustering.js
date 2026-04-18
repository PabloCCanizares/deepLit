import { apiFetch } from './client.js'

export const clusteringAPI = {
  runCollection: async (collectionId, payload) => apiFetch(`/clustering/collections/${collectionId}/runs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  listRuns: async (collectionId) => apiFetch(`/clustering/collections/${collectionId}/runs`, {
    method: 'GET',
  }),

  getRunResults: async (runId) => apiFetch(`/clustering/runs/${runId}/results`, {
    method: 'GET',
  }),

  deleteRun: async (runId) => apiFetch(`/clustering/runs/${runId}`, {
    method: 'DELETE',
  }),
}
