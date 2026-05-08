const STATUS_LABELS = {
  queued: 'En cola',
  processing: 'Procesando',
  completed: 'Completado',
  failed: 'Fallido',
}

function RunStatusBadge({ status, className = '' }) {
  const normalizedStatus = status || 'queued'
  const label = STATUS_LABELS[normalizedStatus] || normalizedStatus

  return (
    <span className={`workflow-status-badge ${normalizedStatus} ${className}`.trim()}>
      {label}
    </span>
  )
}

export default RunStatusBadge
