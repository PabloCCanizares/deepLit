import { apiFetch } from './client.js'

export const evidenceExtractionAPI = {
  runCollection: async (collectionId, payload) => apiFetch(`/evidence-extraction/collections/${collectionId}/runs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  listRuns: async (collectionId) => apiFetch(`/evidence-extraction/collections/${collectionId}/runs`, {
    method: 'GET',
  }),

  getRunResults: async (runId) => apiFetch(`/evidence-extraction/runs/${runId}/results`, {
    method: 'GET',
  }),

  deleteRun: async (runId) => apiFetch(`/evidence-extraction/runs/${runId}`, {
    method: 'DELETE',
  }),
}
