import { apiFetch } from './client.js'

export const collectionSynthesisAPI = {
  runSynthesis: async (collectionId, prompt) => apiFetch(`/collection-synthesis/collections/${collectionId}/runs`, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  }),

  listRuns: async (collectionId) => apiFetch(`/collection-synthesis/collections/${collectionId}/runs`, {
    method: 'GET',
  }),

  generatePaper: async (runId) => apiFetch(`/collection-synthesis/runs/${runId}/paper`, {
    method: 'POST',
  }),

  deleteRun: async (runId) => apiFetch(`/collection-synthesis/runs/${runId}`, {
    method: 'DELETE',
  }),
}
