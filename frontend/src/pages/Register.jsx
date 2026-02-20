import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/Auth.css'

function Register() {
  const navigate = useNavigate()
  const { register, isAuthenticated, loading: authLoading } = useAuth()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
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
      setError('Por favor, completa todos los campos obligatorios')
      setSubmitting(false)
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      setError('Por favor, introduce un email valido (ej: usuario@ejemplo.com)')
      setSubmitting(false)
      return
    }

    if (formData.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      setSubmitting(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden')
      setSubmitting(false)
      return
    }

    try {
      await register(formData.email, formData.password, formData.name)
      navigate('/dashboard')
    } catch (err) {
      console.error('Error en register:', err)
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
          <p>Crear cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Nombre (opcional)</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Tu nombre"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
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
            <label htmlFor="password">Contrasena *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimo 6 caracteres"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar contrasena *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repite tu contrasena"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Ya tienes cuenta?{' '}
            <Link to="/login" className="auth-link">
              Inicia sesion aqui
            </Link>
          </p>
          <p className="auth-preview-copy">
            Prefieres mirar la app antes?{' '}
            <Link to="/preview" className="auth-link">
              Abrir vista previa
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
