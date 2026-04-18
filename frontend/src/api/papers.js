import { apiFetch, fetchFile } from './client.js'

export const papersAPI = {
  create: (file, collection_id, title = null, notes = null) => (
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64String = e.target.result.split(',')[1]
        apiFetch('/papers', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            content: base64String,
            collection_id,
            title,
            notes,
          }),
        }).then(resolve).catch(reject)
      }
      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsDataURL(file)
    })
  ),

  getAll: async () => apiFetch('/papers', { method: 'GET' }),

  getByCollection: async (collectionId) => apiFetch(`/papers/collection/${collectionId}`, { method: 'GET' }),

  getById: async (paperId) => apiFetch(`/papers/${paperId}`, { method: 'GET' }),

  getPdf: async (paperId) => fetchFile(`/papers/${paperId}/pdf`),

  update: async (paperId, data) => apiFetch(`/papers/${paperId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: async (paperId) => apiFetch(`/papers/${paperId}`, { method: 'DELETE' }),
}
