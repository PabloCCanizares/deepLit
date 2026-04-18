import { useEffect, useRef } from 'react'

export function useIntervalPolling(callback, { enabled = true, intervalMs = 4000 } = {}) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return undefined

    const intervalId = setInterval(() => {
      callbackRef.current?.()
    }, intervalMs)

    return () => clearInterval(intervalId)
  }, [enabled, intervalMs])
}
