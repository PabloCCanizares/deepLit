import { apiFetch } from './client.js'

export const uploadAPI = {
  uploadPDF: (file, collection_id) => (
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      console.log('uploadAPI.uploadPDF called with collection_id:', collection_id)
      reader.onload = async (e) => {
        const base64String = e.target.result.split(',')[1]
        apiFetch('/pdfs', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, content: base64String, collection_id }),
        }).then(resolve).catch(reject)
      }

      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsDataURL(file)
    })
  ),

  uploadExcel: (file, collection_id) => (
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      console.log('uploadAPI.uploadExcel called with collection_id:', collection_id)
      reader.onload = async (e) => {
        const base64String = e.target.result.split(',')[1]
        apiFetch('/excels', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, content: base64String, collection_id }),
        }).then(resolve).catch(reject)
      }

      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsDataURL(file)
    })
  ),
}
