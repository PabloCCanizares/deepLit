import { useEffect, useRef } from 'react'
import { articlesAPI } from '../api/index.js'

export const usePollingArticles = (onChanged, pollInterval = 3000) => {
  const lastStatusMapRef = useRef({})
  const pollingTimeoutRef = useRef(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    const poll = async () => {
      try {
        const response = await articlesAPI.getArticles({
          limit: 500,
          offset: 0,
          filters: { mode: 'all' },
        })

        if (!isMountedRef.current) return

        const articles = response.data.articles
        let hasChanges = false
        const currentStatusMap = {}

        for (const article of articles) {
          currentStatusMap[article._id] = article.status
          if (lastStatusMapRef.current[article._id] !== article.status) {
            hasChanges = true
          }
        }

        lastStatusMapRef.current = currentStatusMap

        if (hasChanges) {
          onChanged?.()
        }

        const processingCount = articles.filter((article) => article.status === 'processing').length
        if (processingCount > 0 && isMountedRef.current) {
          pollingTimeoutRef.current = setTimeout(poll, pollInterval)
        }
      } catch (error) {
        console.error('Error en polling:', error)
        if (isMountedRef.current) {
          pollingTimeoutRef.current = setTimeout(poll, pollInterval)
        }
      }
    }

    poll()

    return () => {
      isMountedRef.current = false
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
      }
    }
  }, [onChanged, pollInterval])
}
