function NotificationToast({ message, onClose }) {
  if (!message) return null

  const isError = message.toLowerCase().includes('error')

  return (
    <div className={`upload-success-notification ${isError ? 'error' : ''}`}>
      <i className={`fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          className="notification-close"
          onClick={onClose}
          aria-label="Cerrar notificación"
        >
          <i className="fas fa-times"></i>
        </button>
      )}
    </div>
  )
}

export default NotificationToast
