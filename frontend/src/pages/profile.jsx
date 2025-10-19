import { useAuth } from '../context/AuthContext'
import '../styles/App.css'

function Profile() {
  const { user } = useAuth();

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'white',
      paddingTop: '2rem',
      paddingBottom: '2rem'
    }}>
      <div className="container">
        <h1 style={{ color: '#4f46e5', marginBottom: '1rem' }}>Perfil de Usuario</h1>
¡      </div>
    </div>
  )
}

export default Profile
