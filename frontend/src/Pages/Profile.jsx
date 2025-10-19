import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import '../styles/App.css'
import '../styles/Profile.css'

function Profile() {
  const { user, updateProfile, changePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showMessage, setShowMessage] = useState(false);
  
  // Estado para edición de nombre
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  
  // Estado para cambio de contraseña
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // Estado para imagen de perfil
  const [profileImage, setProfileImage] = useState(user?.profileImage || null);
  const [previewImage, setPreviewImage] = useState(user?.profileImage || null);
  const [imageChanged, setImageChanged] = useState(false);

  // Auto-cerrar mensajes después de 3.5 segundos
  useEffect(() => {
    if (message.text) {
      setShowMessage(true);
      const timer = setTimeout(() => {
        setShowMessage(false);
        setTimeout(() => setMessage({ type: '', text: '' }), 500);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Por favor selecciona una imagen válida' });
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'La imagen no debe superar 5MB' });
        return;
      }

      try {
        setLoading(true);
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          const base64String = e.target.result;
          setPreviewImage(base64String);
          setImageChanged(true);
          setMessage({ type: '', text: '' });
        };

        reader.readAsDataURL(file);
      } catch (error) {
        setMessage({ type: 'error', text: error.message || 'Error al seleccionar la imagen' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveImage = async () => {
    try {
      setLoading(true);
      await updateProfile(newName, previewImage);
      setProfileImage(previewImage);
      setImageChanged(false);
      setMessage({ type: 'success', text: 'Imagen de perfil actualizada' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Error al actualizar la imagen' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      setMessage({ type: 'error', text: 'El nombre no puede estar vacío' });
      return;
    }

    try {
      setLoading(true);
      await updateProfile(newName, profileImage);
      setEditingName(false);
      setMessage({ type: 'success', text: 'Nombre actualizado correctamente' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Error al actualizar el nombre' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      setMessage({ type: 'error', text: 'Todos los campos son requeridos' });
      return;
    }

    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }

    if (passwords.new.length < 6) {
      setMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }

    try {
      setLoading(true);
      await changePassword(passwords.current, passwords.new);
      setPasswords({ current: '', new: '', confirm: '' });
      setShowPasswordChange(false);
      setMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Error al cambiar la contraseña' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'white',
        paddingTop: '2rem',
        paddingBottom: '2rem'
      }}>
        <div className="container">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'white',
      paddingTop: '2rem',
      paddingBottom: '2rem'
    }}>
      <div className="container">
        <h1 style={{ color: '#4f46e5', marginBottom: '2rem' }}>Perfil de Usuario</h1>

        {/* Mensaje de feedback */}
        {message.text && (
          <div className={`profileMessage ${message.type} ${!showMessage ? 'fadeOut' : ''}`}>
            {message.text}
          </div>
        )}

        {/* Sección de Imagen de Perfil */}
        <div className="profileCard">
          <div className="profileImageSection">
            <div className="profileImageContainer">
              {previewImage ? (
                <img src={previewImage} alt="Perfil" className="profileImage" />
              ) : (
                <div className="profileImagePlaceholder">
                  <i className="fas fa-user"></i>
                </div>
              )}
            </div>
            <div className="profileImageActions">
              <label className="profileImageButton">
                <i className="fas fa-camera"></i> Cambiar Imagen
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
              </label>
              <p className="profileImageHint">JPG, PNG. Máximo 5MB</p>
              {imageChanged && (
                <div className="profileImageActions" style={{ marginTop: '1rem' }}>
                  <button 
                    className="profileButtonPrimary"
                    onClick={handleSaveImage}
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button 
                    className="profileButtonSecondary"
                    onClick={() => {
                      setPreviewImage(profileImage);
                      setImageChanged(false);
                    }}
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sección de Información Personal */}
        <div className="profileCard">
          <h2 className="profileCardTitle">Información Personal</h2>

          {/* Campo Nombre */}
          <div className="profileField">
            <label className="profileLabel">Nombre</label>
            {editingName ? (
              <div className="profileFieldEdit">
                <input 
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="profileInput"
                  disabled={loading}
                  placeholder="Ingresa tu nombre"
                />
                <button 
                  className="profileButtonPrimary"
                  onClick={handleSaveName}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button 
                  className="profileButtonSecondary"
                  onClick={() => {
                    setEditingName(false);
                    setNewName(user?.name || '');
                  }}
                  disabled={loading}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="profileFieldDisplay">
                <input 
                  type="text"
                  value={newName}
                  className="profileInputDisabled"
                  disabled
                />
                <button 
                  className="profileButtonEdit"
                  onClick={() => setEditingName(true)}
                  disabled={loading}
                >
                  <i className="fas fa-edit"></i> Editar
                </button>
              </div>
            )}
          </div>

          {/* Campo Email */}
          <div className="profileField">
            <label className="profileLabel">Correo Electrónico</label>
            <div className="profileFieldDisplay">
              <input 
                type="email"
                value={user?.email || ''}
                className="profileInputDisabled"
                disabled
              />
              <span className="profileFieldHint">No se puede cambiar</span>
            </div>
          </div>
        </div>

        {/* Sección de Seguridad */}
        <div className="profileCard">
          <h2 className="profileCardTitle">Seguridad</h2>

          {!showPasswordChange ? (
            <button 
              className="profileButtonPrimary"
              onClick={() => setShowPasswordChange(true)}
              disabled={loading}
            >
              <i className="fas fa-lock"></i> Cambiar Contraseña
            </button>
          ) : (
            <div className="profilePasswordForm">
              <div className="profileField">
                <label className="profileLabel">Contraseña Actual</label>
                <input 
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  className="profileInput"
                  disabled={loading}
                  placeholder="Ingresa tu contraseña actual"
                />
              </div>

              <div className="profileField">
                <label className="profileLabel">Nueva Contraseña</label>
                <input 
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  className="profileInput"
                  disabled={loading}
                  placeholder="Ingresa la nueva contraseña"
                />
              </div>

              <div className="profileField">
                <label className="profileLabel">Confirmar Contraseña</label>
                <input 
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  className="profileInput"
                  disabled={loading}
                  placeholder="Confirma la nueva contraseña"
                />
              </div>

              <div className="profileFormActions">
                <button 
                  className="profileButtonPrimary"
                  onClick={handleChangePassword}
                  disabled={loading}
                >
                  {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
                </button>
                <button 
                  className="profileButtonSecondary"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswords({ current: '', new: '', confirm: '' });
                  }}
                  disabled={loading}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Profile
