import { apiFetch } from './client.js'

export const aiAssistantAPI = {
  chat: async (message, selected_mode, collection_id = null, runtime_mode = null, web_provider = null) => (
    apiFetch('/ai-assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        selected_mode: selected_mode || null,
        collection_id: collection_id || null,
        runtime_mode: runtime_mode || null,
        web_provider: web_provider || null,
      }),
    })
  ),
}
