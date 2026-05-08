function WorkflowProgressSummary({
  collectionName,
  summary,
  loading,
  completedSteps,
  activeRuns,
}) {
  const totalArticles = summary?.totalArticles || 0
  const pdfArticles = summary?.pdfArticles || 0
  const metadataArticles = summary?.metadataArticles || 0
  const pendingArticles = summary?.pendingArticles || 0

  return (
    <section className="workflow-summary-grid" aria-label="Resumen del flujo">
      <article className="workflow-summary-card wide">
        <span className="workflow-summary-label">Coleccion activa</span>
        <strong>{collectionName || 'Sin coleccion seleccionada'}</strong>
        <p>{loading ? 'Actualizando resumen de articulos...' : 'Contexto compartido por todas las etapas del flujo.'}</p>
      </article>

      <article className="workflow-summary-card">
        <span className="workflow-summary-label">Articulos</span>
        <strong>{totalArticles}</strong>
        <p>Total en la coleccion</p>
      </article>

      <article className="workflow-summary-card">
        <span className="workflow-summary-label">PDF procesado</span>
        <strong>{pdfArticles}</strong>
        <p>{metadataArticles} solo metadatos</p>
      </article>

      <article className="workflow-summary-card">
        <span className="workflow-summary-label">Pendientes</span>
        <strong>{pendingArticles + activeRuns}</strong>
        <p>{activeRuns} runs activos</p>
      </article>

      <article className="workflow-summary-card">
        <span className="workflow-summary-label">Progreso</span>
        <strong>{completedSteps}/4</strong>
        <p>Etapas con resultados</p>
      </article>
    </section>
  )
}

export default WorkflowProgressSummary
