import '../../styles/articles/Pagination.css'

function Pagination({ pagination, onChangePagination }) {
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  const goToPrevious = () => {
    if (pagination.offset > 0) {
      onChangePagination({
        ...pagination,
        offset: Math.max(0, pagination.offset - pagination.limit)
      })
    }
  }

  const goToNext = () => {
    if ((pagination.offset + pagination.limit) < pagination.total) {
      onChangePagination({
        ...pagination,
        offset: pagination.offset + pagination.limit
      })
    }
  }

  const goToPage = (pageNumber) => {
    onChangePagination({
      ...pagination,
      offset: (pageNumber - 1) * pagination.limit
    })
  }

  // Generar números de página - máximo 10 consecutivos
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 10
    
    // Calcular el grupo de 10 al que pertenece la página actual
    const currentGroup = Math.floor((currentPage - 1) / maxVisible)
    const startPage = currentGroup * maxVisible + 1
    const endPage = Math.min(startPage + maxVisible - 1, totalPages)
    
    // Mostrar páginas del grupo actual
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
        onClick={goToPrevious} 
        disabled={currentPage <= 1}
        title="Página anterior"
      >
        <i className="fas fa-chevron-left"></i>
      </button>
      
      <div className="page-numbers">
        {getPageNumbers().map((page) => (
          <button
            key={page}
            className={`page-number ${currentPage === page ? 'active' : ''}`}
            onClick={() => goToPage(page)}
          >
            {page}
          </button>
        ))}
      </div>
      
      <button 
        className="pagination-arrow" 
        onClick={goToNext} 
        disabled={currentPage >= totalPages}
        title="Página siguiente"
      >
        <i className="fas fa-chevron-right"></i>
      </button>
    </div>
  )
}

export default Pagination
