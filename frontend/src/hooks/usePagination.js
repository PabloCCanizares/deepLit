import { useCallback } from 'react'

export function usePagination(pagination, setPagination) {
  const { total, limit, offset } = pagination

  console.log("PAGINATION", total, limit, offset)
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  const setPage = useCallback((page) => {
    setPagination(prev => ({
      ...prev,
      offset: (page - 1) * prev.limit
    }))
  }, [setPagination])

  const nextPage = useCallback(() => {
    setPagination(prev => {
      if (prev.offset + prev.limit >= prev.total) return prev
      return { ...prev, offset: prev.offset + prev.limit }
    })
  }, [setPagination])

  const prevPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit)
    }))
  }, [setPagination])

  const setLimit = useCallback((newLimit) => {
    setPagination(prev => ({
      ...prev,
      limit: newLimit,
      offset: 0
    }))
  }, [setPagination])

  return {
    currentPage,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    setLimit
  }
}