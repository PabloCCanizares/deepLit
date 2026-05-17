import { useQuery } from '@tanstack/react-query'

import { articlesAPI } from '../api/index.js'

export function buildArticlesListQueryKey({
  collectionId = null,
  limit = 10,
  offset = 0,
  sortBy = null,
  filters = {},
} = {}) {
  return [
    'articles',
    'list',
    {
      collectionId,
      limit,
      offset,
      sortBy,
      filters,
    },
  ]
}

export function useArticlesListQuery({
  collectionId = null,
  limit = 10,
  offset = 0,
  sortBy = null,
  filters = {},
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: buildArticlesListQueryKey({
      collectionId,
      limit,
      offset,
      sortBy,
      filters,
    }),
    queryFn: () =>
      articlesAPI.getArticles({
        collection_id: collectionId || undefined,
        limit,
        offset,
        filters,
        sort_by: sortBy,
      }),
    enabled,
    staleTime: 0, 
  })
}
