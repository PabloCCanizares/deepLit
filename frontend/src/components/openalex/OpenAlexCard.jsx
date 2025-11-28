import { Link } from 'react-router-dom'
import { useState, useRef } from 'react'
import '../../styles/openalex/OpenAlexCard.css'

function OpenAlexCard({ document, baseRoute = '/openalex', selectedArticles = [], onSelectArticle, savedArticles = [], onSave, onSaveMultiple }) {
  const title = document.title || '-' //FIXME Cambiar por Untitled?
  const category = document.category || '-'
  const year = document.year || '-'
  const id = document._id || document.id
  const isSelected = selectedArticles.includes(id)
  
  // Codificar el ID para usar en la URL (especialmente para IDs de OpenAlex que son URLs)
  const encodedId = encodeURIComponent(id)
  let clean_id = id
  
  // Usar ref para almacenar el estado inicial y no reinicializarlo
  const initialSavedRef = useRef(null)
  if (initialSavedRef.current === null) {
    initialSavedRef.current = savedArticles && (savedArticles.includes(id) || savedArticles.includes(clean_id))
  }
  
  const [saved, setSaved] = useState(initialSavedRef.current)
  const [saving, setSaving] = useState(false)

  const handleCheckboxClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onSelectArticle) {
      onSelectArticle(id)
    }
  }

  return (
    <div className={`lib-item ${isSelected ? 'selected' : ''}`}>
      {onSelectArticle && (
        <div className="article-checkbox" onClick={handleCheckboxClick}>
          <i className={`fas ${isSelected ? 'fa-check-square' : 'fa-square'}`}></i>
        </div>
      )}
      <Link to={`${baseRoute}/${encodedId}`} className="lib-cover-link">
        <div className="lib-cover">
          <div className="lib-cover-overlay">
            <i className="fas fa-eye lib-cover-icon"></i>
          </div>
        </div>
      </Link>
      <div className="lib-meta">
        <div className="title-line" title={title}>
          <strong>Título:</strong> {title}
        </div>
        <div><strong>Categoría:</strong> {category}</div>
        <div><strong>Año:</strong> {year}</div>
        <div className="lib-edit-btn">
          <Link to={`${baseRoute}/${encodedId}/edit`} title="Editar">
            <i className="fas fa-edit"></i> Editar
          </Link>

          {onSave && (
            <button
              className={`save-article-btn ${saved ? 'saved' : ''}`}
              title={saved ? 'Quitar de colección' : 'Guardar en colección actual'}
              onClick={async (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                if (!onSave) return; 
                try { 
                  setSaving(true);
                  const result = await onSave(clean_id || id, saved); 
                  if (result !== false) {
                    setSaved(!saved);
                  }
                } catch (err) { 
                  console.error(err) 
                } finally { 
                  setSaving(false) 
                } 
              }}
              disabled={saving}
            >
              <i className={saved ? 'fas fa-bookmark' : 'far fa-bookmark'}></i>
            </button>
          )}

          {onSaveMultiple && (
            <button
              className="save-multiple-btn"
              title="Guardar en múltiples colecciones"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveMultiple(clean_id || id) }}
            >
              <i className="fas fa-layer-group"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OpenAlexCard
