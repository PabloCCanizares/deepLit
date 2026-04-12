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
