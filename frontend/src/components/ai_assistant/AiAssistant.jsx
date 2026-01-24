import { useState, useEffect, useRef } from 'react'
import '../../styles/App.css'

function AiAssistant() {
  const [showChat, setShowChat] = useState(false)
  const [message, setMessage] = useState('')
  const [showTools, setShowTools] = useState(false)
  const chatRef = useRef(null)
  const chatButtonRef = useRef(null)
  const toolButtonRef = useRef(null)
  const toolMenuRef = useRef(null)

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

  const handleSend = () => {
    if (!message.trim()) {
      return
    }
    setMessage('')
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

        <div className="chat-body">
          <div className="message bot">
            <p>Hola, soy tu asistente IA. ¿En qué puedo ayudarte?</p>
          </div>
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
              <i className="fas fa-tools"></i>
            </button>
            <div
              className={`tools-menu ${showTools ? 'active' : ''}`}
              ref={toolMenuRef}
              role="menu"
            >
              <button className="tools-item" type="button" role="menuitem">
                <i className="fas fa-brain"></i>
                <span>Deep research</span>
              </button>
              <button className="tools-item" type="button" role="menuitem">
                <i className="fas fa-globe"></i>
                <span>Web research</span>
              </button>
              <button className="tools-item" type="button" role="menuitem">
                <i className="fa-solid fa-diagram-project"></i>
                <span>Nexus</span>
              </button>
            </div>
          </div>
          <textarea
            rows={1}
            placeholder="Escribe tu consulta..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="send-btn" onClick={handleSend} aria-label="Enviar mensaje">
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
