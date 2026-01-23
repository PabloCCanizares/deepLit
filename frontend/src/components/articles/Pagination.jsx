import '../../styles/articles/Pagination.css'

function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  onPageChange,
}) {
  // Generar números de página (máx. 10 visibles)
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 10

    const currentGroup = Math.floor((currentPage - 1) / maxVisible)
    const startPage = currentGroup * maxVisible + 1
    const endPage = Math.min(startPage + maxVisible - 1, totalPages)

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return pages
  }

  if (totalPages <= 1) return null

  return (
    <div className="pagination-wrapper">
      <button
        className="pagination-arrow"
        onClick={onPrev}
        disabled={currentPage <= 1}
        title="Página anterior"
      >
        <i className="fas fa-chevron-left"></i>
      </button>

      <div className="page-numbers">
        {getPageNumbers().map((page) => (
          <button
            key={page}
            className={`page-number ${page === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        className="pagination-arrow"
        onClick={onNext}
        disabled={currentPage >= totalPages}
        title="Página siguiente"
      >
        <i className="fas fa-chevron-right"></i>
      </button>
    </div>
  )
}

export default Pagination
