import { Link } from 'react-router-dom'
import { useState } from 'react'
import { getOpenAlexArticleStatus } from './openalexStatus'
import '../../styles/openalex/OpenAlexList.css'

function OpenAlexList({
  documents,
  loading,
  error,
  baseRoute = '/openalex',
  selectedArticles = [],
  onSelectArticle,
  onSelectAll,
  libraryArticleIds = [],
  currentCollectionArticleIds = [],
  hasActiveCollection = false,
  collectionName = '',
  onSave,
  onSaveMultiple,
  sortCriteria,
  onSort,
}) {
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
    <div className="openalex-document-list">
      <div className="openalex-list-header">
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
        <div
          className={`list-col-title sortable-header ${sortCriteria?.startsWith('title') ? 'sort-active' : ''}`}
          onClick={() => onSort?.(sortCriteria === 'title-asc' ? 'title-desc' : 'title-asc')}
        >
          <span>Título</span>
          <i className={`fas ${sortCriteria === 'title-asc' ? 'fa-arrow-up' : sortCriteria === 'title-desc' ? 'fa-arrow-down' : 'fa-sort'} sort-icon`}></i>
        </div>
        <div className="list-col-status">Estado</div>
        <div className="list-col-category">Categoría</div>
        <div
          className={`list-col-year sortable-header ${sortCriteria?.startsWith('year') ? 'sort-active' : ''}`}
          onClick={() => onSort?.(sortCriteria === 'year-asc' ? 'year-desc' : 'year-asc')}
        >
          <span>Año</span>
          <i className={`fas ${sortCriteria === 'year-asc' ? 'fa-arrow-up' : sortCriteria === 'year-desc' ? 'fa-arrow-down' : 'fa-sort'} sort-icon`}></i>
        </div>
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
        
        
        const inLibrary = libraryArticleIds.includes(clean_id) || libraryArticleIds.includes(id)
        const inCurrentCollection =
          hasActiveCollection &&
          (currentCollectionArticleIds.includes(clean_id) || currentCollectionArticleIds.includes(id))
        const status = getOpenAlexArticleStatus({
          inLibrary,
          inCurrentCollection,
          hasActiveCollection,
          collectionName,
        })

        function RowActions({ itemId, rowStatus, rowInLibrary, rowInCurrentCollection }) {
          const [saving, setSaving] = useState(false)

          const handleSaveClick = async () => {
            if (!onSave) return
            try {
              setSaving(true)
              await onSave(itemId, {
                inLibrary: rowInLibrary,
                inCurrentCollection: rowInCurrentCollection,
              })
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
                className={`save-article-btn ${rowInCurrentCollection || rowInLibrary ? 'saved' : ''}`}
                title={rowStatus.actionTitle}
                onClick={handleSaveClick}
                disabled={saving}
              >
                <i className={saving ? 'fas fa-spinner fa-spin' : rowStatus.actionIcon}></i>
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
          <div key={id} className={`openalex-list-row ${isSelected ? 'selected' : ''}`}>
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
            <div className="list-col-status">
              <span className={`openalex-inline-status ${status.badgeTone}`}>{status.badgeLabel}</span>
            </div>
            <div className="list-col-category">{category}</div>
            <div className="list-col-year">{year}</div>
            <RowActions
              key={clean_id}
              itemId={clean_id}
              rowStatus={status}
              rowInLibrary={inLibrary}
              rowInCurrentCollection={inCurrentCollection}
            />
          </div>
        )
      })}
    </div>
  )
}

export default OpenAlexList
