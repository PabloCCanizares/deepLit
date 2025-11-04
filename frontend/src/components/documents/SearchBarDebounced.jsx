import { useState, useEffect } from 'react'

function SearchBarDebounced({ onSearch, placeholder }) {
  const [query, setQuery] = useState('')
  const [typingTimeout, setTypingTimeout] = useState(null)

  // Cada vez que cambia el texto, reiniciamos el temporizador
  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)

    // Limpiamos el timeout anterior
    if (typingTimeout) clearTimeout(typingTimeout)

    // Esperamos 1 segundo antes de ejecutar la búsqueda automática
    const timeout = setTimeout(() => {
      onSearch(value.trim())
    }, 1000)

    setTypingTimeout(timeout)
  }

  // Permitir buscar también al presionar Enter inmediatamente
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (typingTimeout) clearTimeout(typingTimeout) // cancelamos el debounce
      onSearch(query.trim()) // ejecutamos búsqueda inmediata
    }
  }

  // Limpieza del timeout si el componente se desmonta
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout)
    }
  }, [typingTimeout])

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Buscar...'}
        className="search-input"
      />
    </div>
  )
}

export default SearchBarDebounced
