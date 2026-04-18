import { apiFetch } from './client.js'

export const screeningAPI = {
  runCollection: async (collectionId, payload) => apiFetch(`/screening/collections/${collectionId}/runs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  listRuns: async (collectionId) => apiFetch(`/screening/collections/${collectionId}/runs`, {
    method: 'GET',
  }),

  getRunResults: async (runId) => apiFetch(`/screening/runs/${runId}/results`, {
    method: 'GET',
  }),

  updateRunResult: async (runId, articleId, payload) => apiFetch(`/screening/runs/${runId}/results/${articleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),

  deleteRun: async (runId) => apiFetch(`/screening/runs/${runId}`, {
    method: 'DELETE',
  }),
}
