import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import '../styles/App.css'
import '../styles/profile/Profile.css'

function Profile() {
  const { user, updateProfile, changePassword, profileImageUrl, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showMessage, setShowMessage] = useState(false);
  
  // Estado para edición de perfil
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    position: user?.position || '',
    specialization: user?.specialization || '',
    workgroup: user?.workgroup || '',
    degree: user?.degree || '',
    university: user?.university || '',
    experience: user?.experience || ''
  });
  
  // Estado para cambio de contraseña
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // Estado para imagen de perfil
  const [previewImage, setPreviewImage] = useState(null);
  const [newImageBase64, setNewImageBase64] = useState(null);
  
  // Usar la imagen del servidor o el preview local
  const displayImage = previewImage || profileImageUrl;

  // Sincronizar profileData cuando user cambia
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        position: user.position || '',
        specialization: user.specialization || '',
        workgroup: user.workgroup || '',
        degree: user.degree || '',
        university: user.university || '',
        experience: user.experience || ''
      });
    }
  }, [user]);

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
        setMessage({ type: 'error', text: 'Por favor selecciona una imagen válida. JPG, PNG. Máximo 5MB' });
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'La imagen no debe superar 5MB. JPG, PNG. Máximo 5MB' });
        return;
      }

      try {
        setLoading(true);
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          const base64String = e.target.result;
          setNewImageBase64(base64String);
          setPreviewImage(base64String);
          
          // Guardar automáticamente
          try {
            await updateProfile(profileData.name, base64String);
            setMessage({ type: 'success', text: 'Imagen de perfil actualizada' });
          } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Error al actualizar la imagen' });
            setPreviewImage(null);
            setNewImageBase64(null);
          } finally {
            setLoading(false);
          }
        };

        reader.readAsDataURL(file);
      } catch (error) {
        setMessage({ type: 'error', text: error.message || 'Error al seleccionar la imagen' });
        setLoading(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!profileData.name.trim()) {
      setMessage({ type: 'error', text: 'El nombre no puede estar vacío' });
      return;
    }

    try {
      setLoading(true);
      await updateProfile(profileData.name, null);
      setEditingProfile(false);
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Error al actualizar el perfil' });
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

  const handleLogout = () => {
    logout();
  };

  if (!user) {
    return (
      <div className="page-container">
        <div className="container">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="container">
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
              {displayImage ? (
                <img src={displayImage} alt="Perfil" className="profileImage" />
              ) : (
                <div className="profileImagePlaceholder">
                  <i className="fas fa-user"></i>
                </div>
              )}
              <label className="profileImageEditButton">
                <i className="fas fa-pencil-alt"></i>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={loading}
                />
              </label>
            </div>
            <h2 className="profileUserName">{profileData.name || 'Usuario'}</h2>
          </div>
        </div>

        {/* Sección de Información Personal */}
        <div className="profileCard">
          <hr className="profileDivider" /> {/* Línea divisoria */}
          <div className="profileCardHeader">
            <h2 className="profileCardTitle">Información Personal</h2>
            {!editingProfile ? (
              <button 
                className="profileImageEditButton profileEditButton"
                onClick={() => setEditingProfile(true)}
                disabled={loading}
              >
                <i className="fas fa-pencil-alt"></i>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '-1rem', alignItems: 'center' }}>
                <button 
                  className="profileSaveButton"
                  onClick={handleSaveProfile}
                  disabled={loading}
                  title="Guardar cambios"
                >
                  <i className="fas fa-check"></i>
                </button>
                <button 
                  className="profileCancelButton"
                  onClick={() => {
                    setEditingProfile(false);
                    setProfileData({
                      name: user?.name || '',
                      email: user?.email || '',
                      position: user?.position || '',
                      specialization: user?.specialization || '',
                      workgroup: user?.workgroup || '',
                      degree: user?.degree || '',
                      university: user?.university || '',
                      experience: user?.experience || ''
                    });
                  }}
                  disabled={loading}
                  title="Cancelar"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>

          <div className="profileFormGrid">
            {/* Email */}
            <div className="profileField">
              <label className="profileLabel">Correo Electrónico</label>
              <input 
                type="email"
                value={profileData.email}
                className="profileInputDisabled"
                disabled={true}
              />
            </div>

            {/* Cargo Actual */}
            <div className="profileField">
              <label className="profileLabel">Cargo Actual</label>
              <input 
                type="text"
                value={profileData.position}
                onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
                className={editingProfile ? "profileInput" : "profileInputDisabled"}
                disabled={!editingProfile || loading}
                placeholder="Cargo"
              />
            </div>

            {/* Área de Especialización */}
            <div className="profileField">
              <label className="profileLabel">Área de Especialización</label>
              <input 
                type="text"
                value={profileData.specialization}
                onChange={(e) => setProfileData({ ...profileData, specialization: e.target.value })}
                className={editingProfile ? "profileInput" : "profileInputDisabled"}
                disabled={!editingProfile || loading}
                placeholder="Especialización"
              />
            </div>

            {/* Grupo de Trabajo */}
            <div className="profileField">
              <label className="profileLabel">Grupo de Trabajo</label>
              <input 
                type="text"
                value={profileData.workgroup}
                onChange={(e) => setProfileData({ ...profileData, workgroup: e.target.value })}
                className={editingProfile ? "profileInput" : "profileInputDisabled"}
                disabled={!editingProfile || loading}
                placeholder="Grupo de trabajo"
              />
            </div>

            {/* Título Universitario */}
            <div className="profileField">
              <label className="profileLabel">Título Universitario</label>
              <input 
                type="text"
                value={profileData.degree}
                onChange={(e) => setProfileData({ ...profileData, degree: e.target.value })}
                className={editingProfile ? "profileInput" : "profileInputDisabled"}
                disabled={!editingProfile || loading}
                placeholder="Título académico"
              />
            </div>

            {/* Universidad */}
            <div className="profileField">
              <label className="profileLabel">Universidad en la que se Graduó</label>
              <input 
                type="text"
                value={profileData.university}
                onChange={(e) => setProfileData({ ...profileData, university: e.target.value })}
                className={editingProfile ? "profileInput" : "profileInputDisabled"}
                disabled={!editingProfile || loading}
                placeholder="Universidad"
              />
            </div>
          </div>

          {/* Experiencia Profesional - Campo completo */}
          <div className="profileField" style={{ marginTop: '1rem' }}>
            <label className="profileLabel">Experiencia Profesional</label>
            <textarea 
              value={profileData.experience}
              onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
              className={editingProfile ? "profileTextarea" : "profileTextareaDisabled"}
              disabled={!editingProfile || loading}
              placeholder="Describe tu experiencia profesional"
              rows="5"
            />
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

          <div className="profileLogoutSection">
            <button
              className="profileLogoutButton"
              onClick={handleLogout}
              disabled={loading}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
