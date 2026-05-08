function EmptyStepState({ icon = 'fa-circle-info', title, message, action = null }) {
  return (
    <div className="workflow-empty-state">
      <i className={`fas ${icon}`}></i>
      {title ? <h3>{title}</h3> : null}
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  )
}

export default EmptyStepState
