import FilterSortControls from './FilterSortControls'
import SelectionActions from './SelectionActions'

function ArticleControls({
    onSort,
    onFilter,
    viewMode,
    onViewModeChange,
    pagination,
    onChangePagination,
    selectedCount = 0,
    totalCount,
    onSelectAll,
    onDeleteSelected,
    onAddToCollections,
    isCollectionView = false
}) {
    if (selectedCount > 0) {
        return (
            <SelectionActions
                selectedCount={selectedCount}
                onAddToCollections={onAddToCollections}
                onDeleteSelected={onDeleteSelected}
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                pagination={pagination}
                onChangePagination={onChangePagination}
                isCollectionView={isCollectionView}
            />
        )
    }

    return (
        <FilterSortControls
            onSort={onSort}
            onFilter={onFilter}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            pagination={pagination}
            onChangePagination={onChangePagination}
        />
    )
}

export default ArticleControls
