import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Verificar token al cargar la app
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('token');
      
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        // Verificar token con /auth/me
        const response = await authAPI.getMe();
        
        if (response.success) {
          setUser(response.data);
          setToken(storedToken);
        } else {
          // Token inválido
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Error verificando token:', error);
        
        // Si es 401, el token expiró - limpiar sesión
        if (error.status === 401) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          // PrivateRoute redirigirá automáticamente a /login
        }
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      
      if (response.success) {
        const { token, user: userData } = response.data;
        
        // Guardar token
        localStorage.setItem('token', token);
        setToken(token);
        setUser(userData);
        
        return { success: true };
      } else {
        return { success: false, error: response.message };
      }
    } catch (error) {
      console.error('Error en login:', error);
      
      // Manejo de errores de conexión
      if (error.message.includes('fetch')) {
        return { success: false, error: 'No se puede conectar al servidor. Verifica que el backend esté corriendo en http://localhost:8000' };
      }
      
      // error.message siempre existe (viene de api.js con data.message del backend)
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, name = '') => {
    try {
      const response = await authAPI.register(email, password, name);
      
      if (response.success) {
        // Después de registrar, hacer login automático
        return await login(email, password);
      } else {
        return { success: false, error: response.message };
      }
    } catch (error) {
      console.error('Error en register:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

