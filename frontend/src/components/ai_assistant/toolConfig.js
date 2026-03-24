export const AI_ASSISTANT_TOOLS = [
  {
    id: 'deep_researcher',
    label: 'Deep research',
    icon: 'fas fa-brain',
  },
  {
    id: 'web_searcher',
    label: 'Web research',
    icon: 'fas fa-globe',
  },
  {
    id: 'collection_synthesizer',
    label: 'Collection synthesis',
    icon: 'fa-solid fa-diagram-project',
    requiresCollection: true,
    missingCollectionMessage: 'Selecciona una coleccion activa en la barra superior para usar la sintesis de coleccion.',
    placeholder: 'Pregunta que quieres sintetizar de la coleccion activa...',
    disabledPlaceholder: 'Selecciona una coleccion para sintetizarla...',
  },
]

export function getAiToolById(toolId) {
  return AI_ASSISTANT_TOOLS.find((tool) => tool.id === toolId) || null
}

export function getInputPlaceholder({ locked, activeTool, selectedCollectionId }) {
  if (locked) {
    return 'Inicia sesion para usar el asistente...'
  }

  if (activeTool?.requiresCollection && !selectedCollectionId) {
    return activeTool.disabledPlaceholder || 'Selecciona una coleccion para continuar...'
  }

  if (activeTool?.placeholder) {
    return activeTool.placeholder
  }

  return 'Escribe tu consulta...'
}
