import { useEffect, useRef } from 'react'

import { articlesAPI } from '../api/index.js'

const EVENT_HANDLER_KEYS = [
  'onArticleReady',
  'onArticleError',
  'onScreeningReady',
  'onScreeningError',
  'onEvidenceExtractionReady',
  'onEvidenceExtractionError',
  'onCollectionSynthesisReady',
  'onCollectionSynthesisError',
  'onClusteringReady',
  'onClusteringError',
  'onError',
]

export function useArticlesEvents(handlers = {}, enabled = true) {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) return undefined

    const subscriptionHandlers = Object.fromEntries(
      EVENT_HANDLER_KEYS.map((key) => [
        key,
        (...args) => handlersRef.current?.[key]?.(...args),
      ])
    )

    const eventSource = articlesAPI.subscribeEvents(subscriptionHandlers)

    return () => {
      eventSource.close()
    }
  }, [enabled])
}
