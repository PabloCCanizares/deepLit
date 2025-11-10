import { useState } from 'react'
import '../../styles/articles/SearchBar.css'

function SearchBar({ onSearch, placeholder = "Buscar por título" }) {
  const [query, setQuery] = useState('')

  const handleChange = (e) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    onSearch(newQuery) // Búsqueda en tiempo real
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    e.target.querySelector('input').blur() // Quita el foco al presionar Enter
  }

  return (
    <form className="documents-search" onSubmit={handleSubmit}>
      <input
        className="form-control search-input"
        type="text"
        placeholder={placeholder}
        name="query"
        aria-label="Buscar"
        value={query}
        onChange={handleChange}
      />
    </form>
  )
}

export default SearchBar
