import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/Auth.css'

function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated, loading: authLoading } = useAuth()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate])

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    })
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    if (!formData.email || !formData.password) {
      setError('Por favor, completa todos los campos')
      setSubmitting(false)
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Por favor, introduce un email valido (ej: usuario@ejemplo.com)')
      setSubmitting(false)
      return
    }

    try {
      await login(formData.email, formData.password)
      navigate('/dashboard')
    } catch (err) {
      console.error('Error en login:', err)
      setError(err.status ? err.message : 'Error de conexion. Verifica que el backend este corriendo.')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>
            <span className="deepLit-d">deep</span>
            <span className="deepLit-lit">Lit</span>
          </h1>
          <p>Iniciar sesion</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contrasena</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimo 6 caracteres"
              required
              autoComplete="current-password"
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? 'Iniciando sesion...' : 'Iniciar sesion'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            No tienes cuenta?{' '}
            <Link to="/register" className="auth-link">
              Registrate aqui
            </Link>
          </p>
          <p className="auth-preview-copy">
            Quieres probar primero?{' '}
            <Link to="/preview" className="auth-link">
              Ver vista previa
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
