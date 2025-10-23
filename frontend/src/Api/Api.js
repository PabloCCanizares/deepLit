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
  getMe: () => apiFetch('/user/me'),
  logout: () => apiFetch('/auth/logout', {
    method: 'POST',
  }),
  updateProfile: (name, profileImage) => {
    const body = { name };
    if (profileImage) {
      body.profileImage = profileImage;
    }
    return apiFetch('/user/me/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  changePassword: (currentPassword, newPassword) => apiFetch('/user/me/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  }),
};

// Stats API - Estadísticas y analytics
export const statsAPI = {
  getStats: () => apiFetch('/stats/dashboard'),
};

// Upload API - Subida de documentos
export const uploadAPI = {
  uploadPDF: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const base64String = e.target.result.split(',')[1];
        apiFetch('/pdfs', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, content: base64String }),
        }).then(resolve).catch(reject);
      };
      
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  },
};

export const articlesAPI = {
  getArticles: async ({ limit = 10, offset = 0, filters = {} } = {}) => {
    // ✅ POST /articles/search con body
    return apiFetch('/articles/search', {
      method: 'POST',
      body: JSON.stringify({
        pagination: {
          limit,
          offset
        },
        filters: Object.keys(filters).length > 0 ? filters : null
      })
    });
  },
};


export const openalexAPI = {
  getWorks: async ({ limit = 10, offset = 0, filters = {} } = {}) => {
    console.log("API OPENALEX - getWorks called");
    return apiFetch('/openalex/search', {
      method: 'POST',
      body: JSON.stringify({
        pagination: { limit, offset },
        filters: Object.keys(filters).length > 0 ? filters : null
      })
    });
  },
};


// Exportar por defecto para import por defecto
export default {
  auth: authAPI,
  stats: statsAPI,
  upload: uploadAPI,
  articles: articlesAPI,
  openalex: openalexAPI,

};


