import { Link } from 'react-router-dom'
import { useState, useRef } from 'react'
import '../../styles/openalex/OpenAlexList.css'

function OpenAlexList({ documents, loading, error, baseRoute = '/openalex', selectedArticles = [], onSelectArticle, onSelectAll, savedArticles = [], onSave, onSaveMultiple }) {
  if (loading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--main_color)' }}></i>
        <p>Cargando artículos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <i className="fas fa-exclamation-circle" style={{ fontSize: '2rem', color: 'var(--color-danger)' }}></i>
        <p>{error}</p>
      </div>
    )
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="empty-container">
        <i className="fas fa-folder-open" style={{ fontSize: '2rem', color: 'var(--color-violet-light)' }}></i>
        <p>No hay artículos disponibles</p>
      </div>
    )
  }

  return (
    <div className="document-list">
      <div className="list-header">
        <div className="list-col-select">
          {onSelectArticle && (
            <div 
              className="article-checkbox-list header-checkbox" 
              onClick={onSelectAll}
              title={selectedArticles.length === documents.length && documents.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
            >
              <i className={`fas ${selectedArticles.length === documents.length && documents.length > 0 ? 'fa-check-square' : 'fa-square'}`}></i>
            </div>
          )}
        </div>
        <div className="list-col-title">Título</div>
        <div className="list-col-category">Categoría</div>
        <div className="list-col-year">Año</div>
        <div className="list-col-actions">Opciones</div>
      </div>
      
      {documents.map((doc) => {
        const title = doc.title || '-' //FIXME Cambiar por Untitled?
        const category = doc.category || '-'
        const year = doc.year || '-'
        const id = doc._id || doc.id
        const isSelected = selectedArticles.includes(id)
        

        // Codificar el ID para usar en la URL (especialmente para IDs de OpenAlex que son URLs)
        const encodedId = encodeURIComponent(id)

        
        //const clean_id = id.split("/").at(-1);
        let clean_id = id;
        
        
        const isSaved = savedArticles.includes(clean_id) || savedArticles.includes(id);

        function RowActions({itemId, initiallySaved}){
          // Usar ref para mantener el valor inicial y no reinicializarlo
          const initialSavedRef = useRef(initiallySaved)
          const [saved, setSaved] = useState(initialSavedRef.current)
          const [saving, setSaving] = useState(false)

          const handleSaveClick = async () => {
            if (!onSave) return
            try {
              setSaving(true)
              const result = await onSave(itemId, saved)
              if (result !== false) {
                setSaved(!saved)
              }
            } catch (e) {
              console.error('save error', e)
            } finally {
              setSaving(false)
            }
          }

          const handleSaveMultiple = () => {
            if (!onSaveMultiple) return
            onSaveMultiple(itemId)
          }

          return (
            <div className="list-col-actions">
              <Link to={`${baseRoute}/${itemId}`} className="list-action-btn">
                <i className="fas fa-eye"></i>
              </Link>
              <button
                className={`save-article-btn ${saved ? 'saved' : ''}`}
                title={saved ? 'Quitar de colección' : 'Guardar en colección actual'}
                onClick={handleSaveClick}
                disabled={saving}
              >
                <i className={saved ? 'fas fa-bookmark' : 'far fa-bookmark'}></i>
              </button>
              {onSaveMultiple && (
                <button
                  className="save-multiple-btn"
                  title="Guardar en múltiples colecciones"
                  onClick={handleSaveMultiple}
                >
                  <i className="fas fa-layer-group"></i>
                </button>
              )}
            </div>
          )
        }

        return (
          <div key={id} className={`list-row ${isSelected ? 'selected' : ''}`}>
            <div className="list-col-select">
              {onSelectArticle && (
                <div 
                  className="article-checkbox-list" 
                  onClick={() => onSelectArticle(id)}
                >
                  <i className={`fas ${isSelected ? 'fa-check-square' : 'fa-square'}`}></i>
                </div>
              )}
            </div>
            <div className="list-col-title">
              <i className="fas fa-file-alt list-icon"></i>
              <Link to={`${baseRoute}/${clean_id}`} className="list-title-link">
                {title}
              </Link>
            </div>
            <div className="list-col-category">{category}</div>
            <div className="list-col-year">{year}</div>
            <RowActions key={clean_id} itemId={clean_id} initiallySaved={isSaved} />
          </div>
        )
      })}
    </div>
  )
}

export default OpenAlexList




