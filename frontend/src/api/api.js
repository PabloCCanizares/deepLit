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

// Helper genérico para descargar archivos binarios (imágenes, PDFs, etc.)
async function fetchFile(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  
  // Agregar token si existe (igual que apiFetch)
  const token = getAuthToken();
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    
    // Si es 404, devolver null (archivo no existe)
    if (response.status === 404) {
      return null;
    }
    
    // Para otros errores, lanzar (igual que apiFetch)
    if (!response.ok) {
      const error = new Error(`Error al cargar archivo: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('File fetch error:', error);
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
      body.profile_image = profileImage;
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
  // Obtener imagen de perfil
  getProfileImage: () => fetchFile('/user/me/profile-image'),
};

// Stats API - Estadísticas y analytics
export const statsAPI = {
  getStats: () => apiFetch('/stats/dashboard'),
};

// Upload API - Subida de artículos
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

  uploadExcel: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const base64String = e.target.result.split(',')[1];
        apiFetch('/excels', {
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
  // Get articles with pagination
  getArticles: async ({ limit = 10, offset = 0, filters = {} } = {}) => {
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

  // Get single article by ID
  getById: async (id) => {
    return apiFetch(`/articles/${id}`, {
      method: 'GET'
    });
  },

  // Update article by ID
  update: async (id, data) => {
    return apiFetch(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Delete article by ID
  delete: async (id) => {
    return apiFetch(`/articles/${id}`, {
      method: 'DELETE'
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

  // Get single work by ID - Recupera datos del backend usando búsqueda por ID
  getById: async (id) => {
    // OpenAlex usa IDs con formato URL, ejemplo: https://openalex.org/W2741809807
    // Usamos el filtro de búsqueda para encontrar ese artículo específico
    const response = await apiFetch('/openalex/search', {
      method: 'POST',
      body: JSON.stringify({
        pagination: { limit: 1, offset: 0 },
        filters: { "openalex_id": id }
      })
    });
    
    // El artículo debería estar en la primera posición del array
    if (response.data.articles && response.data.articles.length > 0) {
      return { data: response.data.articles[0] };
    } else {
      throw new Error('Artículo no encontrado');
    }
  },
};

export const collectionsAPI = {
  // Get all user collections
  getAll: async () => {
    return apiFetch('/collections', {
      method: 'GET'
    });
  },

  // Create new collection
  create: async (collectionData) => {
    return apiFetch('/collections', {
      method: 'POST',
      body: JSON.stringify(collectionData)
    });
  },

  // Update collection
  update: async (collectionId, collectionData) => {
    return apiFetch(`/collections/${collectionId}`, {
      method: 'PUT',
      body: JSON.stringify(collectionData)
    });
  },

  // Get collection with articles
  getWithArticles: async (collectionId, { limit = 100, offset = 0 } = {}) => {
    return apiFetch(`/collections/${collectionId}/articles?limit=${limit}&offset=${offset}`, {
      method: 'GET'
    });
  },

  // Add article to collection
  addArticle: async (collectionId, articleId) => {
    return apiFetch(`/collections/${collectionId}/articles`, {
      method: 'POST',
      body: JSON.stringify({ article_id: articleId })
    });
  },

  // Remove article from collection
  removeArticle: async (collectionId, articleId) => {
    return apiFetch(`/collections/${collectionId}/articles/${articleId}`, {
      method: 'DELETE'
    });
  },

  // Get collection image (returns blob URL)
  getImage: (collectionId) => {
    return fetchFile(`/collections/${collectionId}/image`);
  },
};


// Exportar por defecto para import por defecto
export default {
  auth: authAPI,
  stats: statsAPI,
  upload: uploadAPI,
  articles: articlesAPI,
  openalex: openalexAPI,
  collections: collectionsAPI,

};


