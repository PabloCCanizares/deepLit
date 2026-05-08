function WorkflowStepSidebar({ steps, activeStep, onStepChange }) {
  return (
    <aside className="workflow-step-sidebar" aria-label="Etapas de revision">
      <div className="workflow-step-sidebar-header">
        <span>Flujo</span>
        <strong>{steps.length} etapas</strong>
      </div>

      <div className="workflow-step-list">
        {steps.map((step, index) => {
          const isActive = activeStep === step.id

          return (
            <button
              key={step.id}
              type="button"
              className={`workflow-step-item ${isActive ? 'active' : ''} ${step.state || 'available'}`}
              onClick={() => onStepChange(step.id)}
            >
              <span className="workflow-step-marker">{index + 1}</span>
              <span className="workflow-step-copy">
                <span className="workflow-step-title-row">
                  <strong>{step.title}</strong>
                  {step.optional ? <em>Opcional</em> : null}
                </span>
                <span>{step.subtitle}</span>
              </span>
              <span className="workflow-step-state">
                <i className={`fas ${step.icon}`}></i>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export default WorkflowStepSidebar
