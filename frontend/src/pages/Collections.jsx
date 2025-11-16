import { useState, useEffect } from 'react'
import { collectionsAPI } from '../api/api'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import CollectionCard from '../components/collections/CollectionCard'
import CreateCollectionModal from '../components/collections/CreateCollectionModal'
import '../styles/App.css'
import '../styles/collections/Collections.css'

function Collections() {
  const [collections, setCollections] = useState([])
  const [filteredCollections, setFilteredCollections] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCollections()
  }, [])

  useEffect(() => {
    // Filtrar colecciones solo por nombre
    if (searchQuery.trim() === '') {
      setFilteredCollections(collections)
    } else {
      const filtered = collections.filter(collection =>
        collection.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredCollections(filtered)
    }
  }, [searchQuery, collections])

  const loadCollections = async () => {
    try {
      setLoading(true)
      const response = await collectionsAPI.getAll()
      setCollections(response.data.collections || [])
      setFilteredCollections(response.data.collections || [])
    } catch (err) {
      console.error('Error loading collections:', err)
      setSuccessMessage('Error al cargar colecciones')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
  }

  const handleCreateCollection = async (collectionData) => {
    try {
      // Crear la colección en el backend
      const response = await collectionsAPI.create({
        name: collectionData.name,
        description: collectionData.category || '',
        color: '#3B82F6'
      })

      const createdCollection = response.data

      // Añadir artículos seleccionados a la colección
      if (collectionData.selectedArticles && collectionData.selectedArticles.length > 0) {
        await Promise.all(
          collectionData.selectedArticles.map(articleId =>
            collectionsAPI.addArticle(createdCollection._id, articleId)
          )
        )
      }

      // Recargar colecciones para obtener datos actualizados
      await loadCollections()
      
      setSuccessMessage('Colección creada correctamente')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Error creating collection:', err)
      setSuccessMessage('Error al crear la colección')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  return (
    <div className="page-container">
      <div className="container">
        {/* Header Panel - Formato igual a Mis Artículos */}
        <div className="header-panel">
          <div className="header-content">
            <div className="header-info">
              <h1 className="header-title">Mis Colecciones</h1>
              <p className="header-subtitle">
                Organiza tus artículos en colecciones temáticas
              </p>
            </div>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-number">{filteredCollections.length}</span>
                <span className="stat-label">Filtradas</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">{collections.length}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje de éxito */}
        {successMessage && (
          <div className="upload-success-notification">
            <i className="fas fa-check-circle"></i>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Barra de búsqueda */}
        <div style={{ marginTop: '2rem' }}>
          <SearchBarDebounced 
            onSearch={handleSearch}
            placeholder="Buscar por nombre"
          />
        </div>

        {/* Vista Mosaico de Colecciones */}
        <div className="collections-grid">
          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: 'var(--main_color)' }}></i>
              <p>Cargando colecciones...</p>
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-folder-open"></i>
              <p>No hay colecciones disponibles</p>
              <button 
                className="btn-create-first"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Crear colección
              </button>
            </div>
          ) : (
            filteredCollections.map(collection => (
              <CollectionCard 
                key={collection._id} 
                collection={collection}
              />
            ))
          )}
        </div>

        {/* Botón flotante para crear colección */}
        <button 
          className="floating-upload-button"
          onClick={() => setIsCreateModalOpen(true)}
          title="Crear nueva colección"
        >
          <i className="fas fa-plus"></i>
        </button>

        {/* Modal de creación */}
        <CreateCollectionModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateCollection}
        />
      </div>
    </div>
  )
}

export default Collections
