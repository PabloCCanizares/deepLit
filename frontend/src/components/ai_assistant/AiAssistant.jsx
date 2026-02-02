import { useState, useEffect, useRef } from 'react'
import { aiAssistantAPI } from '../../api/api'
import '../../styles/App.css'

function AiAssistant() {
  const [showChat, setShowChat] = useState(false)
  const [message, setMessage] = useState('')
  const [showTools, setShowTools] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hola, soy tu asistente IA. ¿En qué puedo ayudarte?' }
  ])
  const [isSending, setIsSending] = useState(false)
  const [selectedTool, setSelectedTool] = useState(null)
  const chatRef = useRef(null)
  const chatButtonRef = useRef(null)
  const toolButtonRef = useRef(null)
  const toolMenuRef = useRef(null)
  const chatBodyRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showChat &&
        chatRef.current &&
        !chatRef.current.contains(event.target) &&
        chatButtonRef.current &&
        !chatButtonRef.current.contains(event.target)
      ) {
        setShowChat(false)
      }

      if (
        showTools &&
        toolMenuRef.current &&
        !toolMenuRef.current.contains(event.target) &&
        toolButtonRef.current &&
        !toolButtonRef.current.contains(event.target)
      ) {
        setShowTools(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showChat, showTools])

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
    }
  }, [messages, showChat])

  const tools = [
    { id: 'deep_researcher', label: 'Deep research', icon: 'fas fa-brain' },
    { id: 'web_searcher', label: 'Web research', icon: 'fas fa-globe' },
    { id: 'nexus', label: 'Nexus', icon: 'fa-solid fa-diagram-project' }
  ]

  const activeTool = tools.find((tool) => tool.id === selectedTool) || null

  const handleSend = async () => {
    const trimmed = message.trim()
    if (!trimmed || isSending) {
      return
    }

    setMessage('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])

    try {
      setIsSending(true)
      const response = await aiAssistantAPI.chat(trimmed, selectedTool)
      const reply = response?.data?.reply || 'No pude generar una respuesta.'
      setMessages((prev) => [...prev, { role: 'bot', content: reply }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'Ocurrió un error al contactar el asistente.' }
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <button
        className="botButton"
        aria-label="Abrir Asistente IA"
        title="Asistente IA"
        aria-expanded={showChat}
        onClick={() => setShowChat((prev) => !prev)}
        ref={chatButtonRef}
      >
        <i className="fas fa-atom"></i>
      </button>

      <div
        className={`ai-chat-interface ${showChat ? 'active' : ''}`}
        id="aiChat"
        ref={chatRef}
      >
        <div className="chat-header"></div>

        <div className="chat-body" ref={chatBodyRef}>
          {messages.map((item, index) => (
            <div key={index} className={`message ${item.role}`}>
              <p>{item.content}</p>
            </div>
          ))}
          {isSending && (
            <div className="typing-indicator">Escribiendo...</div>
          )}
        </div>

        <div className="chat-footer">
          <div className="tools-dropdown">
            <button
              className="tools-btn"
              aria-label="Abrir herramientas"
              title="Herramientas"
              aria-expanded={showTools}
              onClick={() => setShowTools((prev) => !prev)}
              ref={toolButtonRef}
            >
              <i className={activeTool ? `${activeTool.icon} tool-icon-selected` : 'fas fa-tools'}></i>
            </button>
            <div
              className={`tools-menu ${showTools ? 'active' : ''}`}
              ref={toolMenuRef}
              role="menu"
            >
              {selectedTool && (
                <button
                  className="tools-item"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSelectedTool(null)
                    setShowTools(false)
                  }}
                >
                  <i className="fas fa-ban"></i>
                  <span>Sin herramienta</span>
                </button>
              )}
              {tools
                .filter((tool) => tool.id !== selectedTool)
                .map((tool) => (
                  <button
                    key={tool.id}
                    className="tools-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSelectedTool(tool.id)
                      setShowTools(false)
                    }}
                  >
                    <i className={tool.icon}></i>
                    <span>{tool.label}</span>
                  </button>
                ))}
            </div>
          </div>
          <textarea
            rows={1}
            placeholder="Escribe tu consulta..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            aria-label="Enviar mensaje"
            disabled={isSending}
          >
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}

export default AiAssistant
