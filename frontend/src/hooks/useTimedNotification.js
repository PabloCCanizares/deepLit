import { useEffect, useState } from 'react'

export function useTimedNotification(timeoutMs = 4000) {
  const [notification, setNotification] = useState('')

  useEffect(() => {
    if (!notification) return undefined

    const timer = setTimeout(() => setNotification(''), timeoutMs)
    return () => clearTimeout(timer)
  }, [notification, timeoutMs])

  return {
    notification,
    setNotification,
    clearNotification: () => setNotification(''),
  }
}
