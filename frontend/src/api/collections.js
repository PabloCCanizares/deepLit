import { apiFetch, fetchFile } from './client.js'

export const collectionsAPI = {
  getAll: async () => apiFetch('/collections', {
    method: 'GET',
  }),

  create: async (collectionData) => apiFetch('/collections', {
    method: 'POST',
    body: JSON.stringify(collectionData),
  }),

  update: async (collectionId, collectionData) => apiFetch(`/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(collectionData),
  }),

  delete: async (collectionId) => apiFetch(`/collections/${collectionId}`, {
    method: 'DELETE',
  }),

  getWithArticles: async (collectionId, { limit = 100, offset = 0 } = {}) => (
    apiFetch(`/collections/${collectionId}/articles?limit=${limit}&offset=${offset}`, {
      method: 'GET',
    })
  ),

  addArticle: async (collectionId, articleId) => apiFetch(`/collections/${collectionId}/articles`, {
    method: 'POST',
    body: JSON.stringify({ article_id: articleId }),
  }),

  removeArticle: async (collectionId, articleId) => apiFetch(`/collections/${collectionId}/articles/${articleId}`, {
    method: 'DELETE',
  }),

  deleteMany: async (collectionIds) => apiFetch('/collections/batch', {
    method: 'DELETE',
    body: JSON.stringify({ collection_ids: collectionIds }),
  }),

  getImage: (collectionId) => fetchFile(`/collections/${collectionId}/image`),

  getIdsbyCollection: async (collection_id) => apiFetch(`/collections/${collection_id}/ids`, {
    method: 'GET',
  }),

  getLibraryIds: async () => apiFetch('/collections/ids', {
    method: 'GET',
  }),
}
