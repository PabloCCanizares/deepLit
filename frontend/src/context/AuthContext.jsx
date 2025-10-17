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
        
        // Si llega aquí, token válido
        setUser(response.data);
        setToken(storedToken);
      } catch (error) {
        console.error('Error verificando token:', error);
        
        // Token inválido o error de conexión - limpiar sesión
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    
    // Si hay error, authAPI ya lanzó excepción (no llegamos aquí)
    const { token, user: userData } = response.data;
    
    // Guardar token
    localStorage.setItem('token', token);
    setToken(token);
    setUser(userData);
  };

  const register = async (email, password, name = '') => {
    await authAPI.register(email, password, name);
    
    // Si hay error, authAPI ya lanzó excepción (no llegamos aquí)
    // Registro exitoso, hacer login automático
    await login(email, password);
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

