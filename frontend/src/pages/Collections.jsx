import { useState, useEffect } from 'react'
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

  // Mock data - esto se conectará al backend después
  const mockCollections = [
    {
      id: 1,
      name: 'Literatura Moderna',
      category: 'Literatura',
      articles: [1, 2, 3],
      image: null
    },
    {
      id: 2,
      name: 'Ciencias Computacionales',
      category: 'Tecnología',
      articles: [1, 2],
      image: null
    },
    {
      id: 3,
      name: 'Historia Antigua',
      category: 'Historia',
      articles: [1, 2, 3, 4, 5],
      image: null
    }
  ]

  useEffect(() => {
    // Cargar colecciones (mock por ahora)
    setCollections(mockCollections)
    setFilteredCollections(mockCollections)
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

  const handleSearch = (query) => {
    setSearchQuery(query)
  }

  const handleCreateCollection = (collectionData) => {
    // Aquí se conectará al backend
    console.log('Nueva colección:', collectionData)
    
    // Por ahora solo agregamos al mock
    const newCollection = {
      id: collections.length + 1,
      name: collectionData.name,
      category: collectionData.category || 'Sin categoría',
      articles: collectionData.selectedArticles,
      image: collectionData.image
    }
    
    setCollections(prev => [...prev, newCollection])
    setSuccessMessage('Colección creada correctamente')
    
    // Limpiar mensaje después de 3 segundos
    setTimeout(() => setSuccessMessage(''), 3000)
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
          {filteredCollections.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-folder-open"></i>
              <p>No hay colecciones disponibles</p>
              <button 
                className="btn-create-first"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Crear mi primera colección
              </button>
            </div>
          ) : (
            filteredCollections.map(collection => (
              <CollectionCard 
                key={collection.id} 
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
