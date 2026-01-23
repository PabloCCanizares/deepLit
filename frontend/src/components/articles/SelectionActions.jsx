import '../../styles/articles/SelectionActions.css'

function SelectionActions({
    selectedCount,
    onAddToCollections,
    onDeleteSelected = false,
    isCollectionView = false,
    viewMode,
    onViewModeChange
}) {
    return (
        <div className="selection-actions-container">
            <div className="selection-left">
                <span className="selection-count-badge">
                    <i className="fas fa-check-circle"></i>
                    {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
                </span>

                <div className="action-buttons">
                    {onAddToCollections && (
                        <button
                            className="action-icon-btn"
                            onClick={onAddToCollections}
                            title="Añadir a colección(es)"
                        >
                            <i className="fas fa-folder-plus"></i>
                        </button>
                    )}

                    {onDeleteSelected && (
                        <button
                            className="action-icon-btn"
                            onClick={onDeleteSelected}
                            title={isCollectionView ? 'Eliminar de colección' : 'Eliminar seleccionados'}
                        >
                            <i className="fas fa-trash"></i>
                        </button>
                    )}
                </div>
            </div>

            <div className="selection-right">
                <div className="view-toggle">
                    <button
                        type="button"
                        className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => onViewModeChange('list')}
                        title="Vista lista"
                    >
                        <i className="fas fa-list"></i>
                    </button>
                    <button
                        type="button"
                        className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => onViewModeChange('grid')}
                        title="Vista mosaico"
                    >
                        <i className="fas fa-th"></i>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SelectionActions
