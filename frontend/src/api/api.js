// API Configuration
// En desarrollo, Vite proxy redirige /api → http://localhost:8000
// En producción, configurar en .env: VITE_API_URL=https://tu-api.com
const API_BASE = '/api';

// Helper function to get auth token
function getAuthToken() {
  return localStorage.getItem('token');
}

// Helper function for fetch requests
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Agregar token automáticamente si existe
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    headers,
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // Handle empty responses
    if (response.status === 204) {
      return null;
    }

    const data = await response.json();
    
    if (!response.ok) {
      const error = new Error(data.message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API - Autenticación y gestión de sesiones
export const authAPI = {
  login: (email, password) => apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  register: (email, password, name = '') => apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  }),
  getMe: () => apiFetch('/auth/me'),
  logout: () => apiFetch('/auth/logout', {
    method: 'POST',
  }),
};

// Stats API - Estadísticas y analytics
export const statsAPI = {
  getStats: () => apiFetch('/stats'),
};

// Exportar por defecto para import por defecto
export default {
  auth: authAPI,
  stats: statsAPI,
};


