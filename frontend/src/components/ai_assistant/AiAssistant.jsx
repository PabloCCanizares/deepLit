import { useState, useEffect, useRef } from 'react'
import { aiAssistantAPI } from '../../api/api'
import { useCollection } from '../../context/CollectionContext'
import { AI_ASSISTANT_TOOLS, getAiToolById, getInputPlaceholder } from './toolConfig'
import '../../styles/App.css'

function AiAssistant({ locked = false }) {
  const { selectedCollectionId } = useCollection()
  const [showChat, setShowChat] = useState(false)
  const [message, setMessage] = useState('')
  const [showTools, setShowTools] = useState(false)
  const [messages, setMessages] = useState(() => [
    {
      role: 'bot',
      content: locked
        ? 'El asistente IA se desbloquea al iniciar sesion.'
        : 'Hola, soy tu asistente IA. En que puedo ayudarte?',
    },
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

  useEffect(() => {
    if (selectedTool && getAiToolById(selectedTool)?.requiresCollection && !selectedCollectionId) {
      setSelectedTool(null)
    }
  }, [selectedCollectionId, selectedTool])

  const activeTool = getAiToolById(selectedTool)
  const needsSelectedCollection = Boolean(activeTool?.requiresCollection)
  const inputPlaceholder = getInputPlaceholder({
    locked,
    activeTool,
    selectedCollectionId,
  })

  const handleSend = async () => {
    if (locked) {
      return
    }

    const trimmed = message.trim()
    if (!trimmed || isSending) {
      return
    }

    if (needsSelectedCollection && !selectedCollectionId) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: activeTool?.missingCollectionMessage || 'Selecciona una coleccion activa para continuar.',
        },
      ])
      return
    }

    setMessage('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])

    try {
      setIsSending(true)
      const response = await aiAssistantAPI.chat(trimmed, selectedTool, selectedCollectionId)
      const reply = response?.data?.reply || 'No pude generar una respuesta.'
      setMessages((prev) => [...prev, { role: 'bot', content: reply }])
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'bot', content: 'Ocurrio un error al contactar el asistente.' }])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event) => {
    if (locked) {
      return
    }

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

      <div className={`ai-chat-interface ${showChat ? 'active' : ''}`} id="aiChat" ref={chatRef}>
        <div className="chat-header"></div>

        <div className="chat-body" ref={chatBodyRef}>
          {messages.map((item, index) => (
            <div key={index} className={`message ${item.role}`}>
              <p>{item.content}</p>
            </div>
          ))}
          {isSending && <div className="typing-indicator">Pensando...</div>}
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
            <div className={`tools-menu ${showTools ? 'active' : ''}`} ref={toolMenuRef} role="menu">
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
              {AI_ASSISTANT_TOOLS
                .filter((tool) => tool.id !== selectedTool)
                .map((tool) => {
                  const isDisabled = tool.requiresCollection && !selectedCollectionId

                  return (
                  <button
                    key={tool.id}
                    className={`tools-item${isDisabled ? ' disabled' : ''}`}
                    type="button"
                    role="menuitem"
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    title={isDisabled ? 'Selecciona una coleccion para activar esta herramienta.' : tool.label}
                    onClick={() => {
                      if (isDisabled) {
                        return
                      }
                      setSelectedTool(tool.id)
                      setShowTools(false)
                    }}
                  >
                    <i className={tool.icon}></i>
                    <span>{tool.label}</span>
                  </button>
                  )
                })}
            </div>
          </div>
          <textarea
            rows={1}
            placeholder={inputPlaceholder}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={locked}
          />
          <button
            className={`send-btn ${locked ? 'locked' : ''}`}
            onClick={handleSend}
            aria-label={locked ? 'Enviar bloqueado' : 'Enviar mensaje'}
            title={locked ? 'Inicia sesion para enviar' : 'Enviar mensaje'}
            disabled={isSending || locked}
          >
            {locked ? (
              <i className="fas fa-lock"></i>
            ) : (
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10L17 12L2 14L2.01 21Z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export default AiAssistant
