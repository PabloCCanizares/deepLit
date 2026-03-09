import { Link } from 'react-router-dom'
import { useState } from 'react'
import { getOpenAlexArticleStatus } from './openalexStatus'
import '../../styles/openalex/OpenAlexCard.css'

function OpenAlexCard({
  document,
  baseRoute = '/openalex',
  selectedArticles = [],
  onSelectArticle,
  libraryArticleIds = [],
  currentCollectionArticleIds = [],
  hasActiveCollection = false,
  collectionName = '',
  onSave,
  onSaveMultiple,
}) {
  const title = document.title || '-' //FIXME Cambiar por Untitled?
  const category = document.category || '-'
  const year = document.year || '-'
  const id = document._id || document.id
  const isSelected = selectedArticles.includes(id)
  
  // Codificar el ID para usar en la URL (especialmente para IDs de OpenAlex que son URLs)
  const encodedId = encodeURIComponent(id)
  const cleanId = id
  const [saving, setSaving] = useState(false)
  const inLibrary = libraryArticleIds.includes(id) || libraryArticleIds.includes(cleanId)
  const inCurrentCollection =
    hasActiveCollection &&
    (currentCollectionArticleIds.includes(id) || currentCollectionArticleIds.includes(cleanId))
  const status = getOpenAlexArticleStatus({
    inLibrary,
    inCurrentCollection,
    hasActiveCollection,
    collectionName,
  })

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
        <div className={`openalex-status-pill ${status.badgeTone}`}>{status.badgeLabel}</div>
        <div className="lib-edit-btn">
          <Link to={`${baseRoute}/${encodedId}/edit`} title="Editar">
            <i className="fas fa-edit"></i> Editar
          </Link>

          {onSave && (
            <button
              className={`save-article-btn ${inCurrentCollection || inLibrary ? 'saved' : ''}`}
              title={status.actionTitle}
              onClick={async (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                if (!onSave) return; 
                try { 
                  setSaving(true);
                  await onSave(cleanId || id, { inLibrary, inCurrentCollection }); 
                } catch (err) { 
                  console.error(err) 
                } finally { 
                  setSaving(false) 
                } 
              }}
              disabled={saving}
            >
              <i className={saving ? 'fas fa-spinner fa-spin' : status.actionIcon}></i>
            </button>
          )}

          {onSaveMultiple && (
            <button
              className="save-multiple-btn"
              title="Guardar en múltiples colecciones"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveMultiple(cleanId || id) }}
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
