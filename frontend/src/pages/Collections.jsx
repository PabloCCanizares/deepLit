import { useState, useEffect } from 'react'
import { collectionsAPI } from '../api/api'
import SearchBarDebounced from '../components/articles/SearchBarDebounced'
import CollectionCard from '../components/collections/CollectionCard'
import CreateCollectionModal from '../components/collections/CreateCollectionModal'
import '../styles/App.css'
import '../styles/collections/Collections.css'
import { useCollection } from "../context/CollectionContext";

function Collections() {
  const [collections, setCollections] = useState([])
  const [filteredCollections, setFilteredCollections] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCollections, setSelectedCollections] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { refreshCollections } = useCollection();
  
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

  const handleSelectCollection = (collectionId) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        return prev.filter(id => id !== collectionId)
      } else {
        return [...prev, collectionId]
      }
    })
  }

  const handleDeleteSelected = () => {
    if (selectedCollections.length === 0) {
      setSuccessMessage('Selecciona al menos una colección')
      setTimeout(() => setSuccessMessage(''), 3000)
      return
    }
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    setSuccessMessage(`Funcionalidad de eliminar ${selectedCollections.length} colección(es) - Próximamente`)
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowDeleteModal(false)
    setSelectedCollections([])
  }

  const handleCompareCollections = () => {
    if (selectedCollections.length < 2) {
      setSuccessMessage('Selecciona al menos 2 colecciones para comparar')
      setTimeout(() => setSuccessMessage(''), 3000)
      return
    }
    setSuccessMessage('Funcionalidad de comparar colecciones - Próximamente')
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleSaveCollection = async (collectionData) => {
    try {
      console.log('\n=== SAVING COLLECTION ====')
      console.log('Collection data:', collectionData)
      console.log('Image type:', typeof collectionData.image)
      console.log('Image:', collectionData.image ? collectionData.image.substring(0, 100) + '...' : 'None')
      
      if (editingCollection) {
        // Modo edición
        await collectionsAPI.update(editingCollection._id, {
          name: collectionData.name,
          description: collectionData.description || '',
          color: '#3B82F6',
          image: collectionData.image
        })

        // Obtener artículos actuales de la colección
        const currentResponse = await collectionsAPI.getWithArticles(editingCollection._id)
        const currentArticles = currentResponse.data.articles || []
        const currentArticleIds = currentArticles.map(a => a._id || a.id)

        // Determinar artículos a añadir y remover
        const toAdd = collectionData.selectedArticles.filter(id => !currentArticleIds.includes(id))
        const toRemove = currentArticleIds.filter(id => !collectionData.selectedArticles.includes(id))

        // Añadir nuevos artículos
        if (toAdd.length > 0) {
          await Promise.all(
            toAdd.map(articleId =>
              collectionsAPI.addArticle(editingCollection._id, articleId)
            )
          )
        }

        // Remover artículos
        if (toRemove.length > 0) {
          await Promise.all(
            toRemove.map(articleId =>
              collectionsAPI.removeArticle(editingCollection._id, articleId)
            )
          )
        }
        refreshCollections();
        
        setSuccessMessage('Colección actualizada correctamente')
      } else {
        // Modo creación
        const response = await collectionsAPI.create({
          name: collectionData.name,
          description: collectionData.description || '',
          color: '#3B82F6',
          image: collectionData.image
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
        refreshCollections();

        setSuccessMessage('Colección creada correctamente')
      }

      // Recargar colecciones
      await loadCollections()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error('Error saving collection:', err)
      setSuccessMessage(editingCollection ? 'Error al actualizar la colección' : 'Error al crear la colección')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  const handleEditCollection = (collection) => {
    setEditingCollection(collection)
    setIsCreateModalOpen(true)
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

        {/* Controles de selección - Solo aparecen cuando hay colecciones seleccionadas */}
        {selectedCollections.length > 0 && (
          <div className="selection-controls-container">
            <div className="selection-info">
              <span className="selection-count">
                <i className="fas fa-check-circle"></i>
                {selectedCollections.length} colección(es) seleccionada(s)
              </span>
            </div>
            <div className="selection-actions">
              <button 
                className="btn-secondary"
                onClick={handleCompareCollections}
                disabled={selectedCollections.length < 2}
                title={selectedCollections.length < 2 ? 'Selecciona al menos 2 colecciones' : 'Comparar colecciones'}
              >
                <i className="fas fa-code-compare"></i>
                Comparar
              </button>
              <button 
                className="btn-danger"
                onClick={handleDeleteSelected}
              >
                <i className="fas fa-trash"></i>
                Eliminar
              </button>
            </div>
          </div>
        )}

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
              <div key={collection._id} className="collection-card-wrapper">
                <div className="collection-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(collection._id)}
                    onChange={() => handleSelectCollection(collection._id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <CollectionCard 
                  collection={collection}
                  onEdit={handleEditCollection}
                />
              </div>
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

        {/* Modal de creación/edición */}
        <CreateCollectionModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false)
            setEditingCollection(null)
          }}
          onSave={handleSaveCollection}
          collection={editingCollection}
        />

        {/* Modal de confirmación de eliminación */}
        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <i className="fas fa-exclamation-triangle" style={{ color: 'var(--color-danger)' }}></i>
                  {' '}Confirmar Eliminación
                </h2>
              </div>
              <div className="modal-body">
                <p>¿Estás seguro de que quieres eliminar {selectedCollections.length} colección(es)?</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="modal-footer">
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete} 
                  className="btn-danger"
                >
                  <i className="fas fa-trash" style={{ marginRight: '0.5rem' }}></i>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Collections
