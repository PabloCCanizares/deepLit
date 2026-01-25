import { useEffect, useState } from 'react'
import '../../styles/common/Toast.css'

function Toast({ message, onClose, duration = 500 }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (message) {
      setIsVisible(true)
      setIsLeaving(false)

      // Iniciar fade out a los 2 segundos
      const fadeTimer = setTimeout(() => {
        setIsLeaving(true)
      }, duration)

      // Cerrar completamente después del fade (2s + 1s)
      const closeTimer = setTimeout(() => {
        setIsVisible(false)
        onClose()
      }, duration + 1000)

      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(closeTimer)
      }
    }
  }, [message, onClose, duration])

  if (!message || !isVisible) return null

  return (
    <div className={`toast-container ${isLeaving ? 'toast-leaving' : ''}`}>
      <div className="toast">
        <span className="toast-message">{message}</span>
      </div>
    </div>
  )
}

export default Toast
