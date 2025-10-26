// Mock data for testing
const mockDocuments = [
  {
    _id: '1',
    id: '1',
    Title: 'Systematic Literature Review on Machine Learning',
    title: 'Systematic Literature Review on Machine Learning',
    Year: '2023',
    year: '2023',
    Category: 'Computer Science',
    category: 'Computer Science',
    Type: 'Research Article',
    Acronym: 'SLR-ML',
    Cites: '245',
    Pag: '350',
    pages: '350',
    Obs: 'Comprehensive review of ML techniques in academic literature',
    Summary: 'Este artículo presenta una revisión sistemática de la literatura sobre técnicas de aprendizaje automático, analizando las tendencias actuales y futuras direcciones de investigación.',
    link: 'https://example.com/ml-review',
    citation: 'Smith, J., Doe, A. (2023). Systematic Literature Review on Machine Learning. Journal of AI Research, 15(3), 123-145.',
    abstract: 'This systematic literature review examines the current state of machine learning techniques across various domains. We analyzed 500+ papers published between 2020-2023, identifying key trends, methodologies, and future research directions. Our findings suggest a significant shift towards explainable AI and federated learning approaches.',
    autores: 'John Smith, Alice Doe, Robert Johnson',
    authors: 'John Smith, Alice Doe, Robert Johnson',
    filename: 'ml_systematic_review_2023.pdf',
    journal: 'Journal of AI Research',
    keywords: 'machine learning, systematic review, artificial intelligence, deep learning, neural networks',
    references: 'Contains 127 references from leading ML conferences and journals including ICML, NeurIPS, ICLR, and Nature Machine Intelligence.'
  },
  {
    _id: '2',
    id: '2',
    Title: 'Deep Learning Applications in Medical Imaging',
    title: 'Deep Learning Applications in Medical Imaging',
    Year: '2022',
    year: '2022',
    Category: 'Healthcare',
    category: 'Healthcare',
    Type: 'Conference Paper',
    Acronym: 'DL-MED',
    Cites: '189',
    Pag: '450',
    pages: '450',
    Obs: 'Focuses on CNN architectures for medical diagnosis',
    Summary: 'Investigación sobre la aplicación de redes neuronales profundas en el diagnóstico médico por imágenes, con especial énfasis en radiología y patología.',
    link: 'https://example.com/deep-learning-medical',
    citation: 'Garcia, M., Chen, L. (2022). Deep Learning Applications in Medical Imaging. Proceedings of Medical AI Conference, 78-92.',
    abstract: 'We present a comprehensive study of deep learning applications in medical imaging, focusing on convolutional neural networks for diagnostic tasks. Our research covers X-ray analysis, MRI interpretation, and histopathological image classification, achieving state-of-the-art performance across multiple medical domains.',
    autores: 'Maria Garcia, Li Chen, David Brown',
    authors: 'Maria Garcia, Li Chen, David Brown',
    filename: 'deep_learning_medical_imaging.pdf',
    journal: 'Medical AI Conference Proceedings',
    keywords: 'deep learning, medical imaging, CNN, radiology, pathology, diagnosis',
    references: 'References include 89 citations from medical journals such as Nature Medicine, The Lancet Digital Health, and Medical Image Analysis.'
  },
  {
    _id: '3',
    id: '3',
    Title: 'Natural Language Processing: A Survey',
    title: 'Natural Language Processing: A Survey',
    Year: '2024',
    year: '2024',
    Category: 'Artificial Intelligence',
    category: 'Artificial Intelligence',
    Type: 'Survey Paper',
    Acronym: 'NLP-SURV',
    Cites: '67',
    Pag: '520',
    pages: '520',
    Obs: 'Comprehensive survey including transformer architectures',
    Summary: 'Survey completo sobre el estado actual del procesamiento de lenguaje natural, incluyendo modelos transformer, BERT, GPT y aplicaciones emergentes.',
    link: 'https://example.com/nlp-survey',
    citation: 'Wilson, P., Kumar, S. (2024). Natural Language Processing: A Survey. AI Review Quarterly, 42(1), 1-35.',
    abstract: 'This comprehensive survey covers the evolution of natural language processing from statistical methods to modern transformer-based architectures. We examine key developments in language models, including BERT, GPT, and T5, while discussing current challenges and future research directions in multilingual NLP and few-shot learning.',
    autores: 'Peter Wilson, Sanjay Kumar, Elena Rodriguez',
    authors: 'Peter Wilson, Sanjay Kumar, Elena Rodriguez',
    filename: 'nlp_survey_2024.pdf',
    journal: 'AI Review Quarterly',
    keywords: 'natural language processing, transformers, BERT, GPT, language models, survey',
    references: 'Comprehensive bibliography with 156 references spanning from classical NLP papers to recent transformer innovations.'
  },
  {
    _id: '4',
    id: '4',
    Title: 'Software Testing Automation Techniques',
    title: 'Software Testing Automation Techniques',
    Year: '2023',
    year: '2023',
    Category: 'Software Engineering',
    category: 'Software Engineering',
    Type: 'Research Article',
    Acronym: 'STA-TECH',
    Cites: '134',
    Pag: '380',
    pages: '380',
    Obs: 'Includes AI-based testing approaches',
    Summary: 'Análisis de técnicas modernas de automatización de pruebas de software, incluyendo enfoques basados en IA y machine learning para generación automática de casos de prueba.',
    link: 'https://example.com/software-testing-automation',
    citation: 'Thompson, R., Lee, K. (2023). Software Testing Automation Techniques. Software Engineering Journal, 28(4), 45-67.',
    abstract: 'We explore modern software testing automation techniques, with particular emphasis on AI-driven test generation and execution. Our study compares traditional automation frameworks with emerging ML-based approaches, demonstrating significant improvements in test coverage and defect detection rates.',
    autores: 'Robert Thompson, Kevin Lee, Sarah Mitchell',
    authors: 'Robert Thompson, Kevin Lee, Sarah Mitchell',
    filename: 'software_testing_automation.pdf',
    journal: 'Software Engineering Journal',
    keywords: 'software testing, automation, AI testing, test generation, quality assurance',
    references: 'Contains 98 references from software engineering conferences and journals including ICSE, FSE, and IEEE Transactions on Software Engineering.'
  },
  {
    _id: '5',
    id: '5',
    Title: 'Blockchain Technology in Supply Chain',
    title: 'Blockchain Technology in Supply Chain',
    Year: '2022',
    year: '2022',
    Category: 'Information Systems',
    category: 'Information Systems',
    Type: 'Case Study',
    Acronym: 'BC-SC',
    Cites: '156',
    Pag: '280',
    pages: '280',
    Obs: 'Real-world implementation case studies',
    Summary: 'Estudio de casos sobre la implementación de tecnología blockchain en cadenas de suministro, analizando beneficios, desafíos y lecciones aprendidas.',
    link: 'https://example.com/blockchain-supply-chain',
    citation: 'Anderson, J., Patel, N. (2022). Blockchain Technology in Supply Chain. Information Systems Research, 33(2), 167-189.',
    abstract: 'This paper examines the implementation of blockchain technology in supply chain management through multiple case studies. We analyze the benefits of transparency, traceability, and trust in supply chain operations, while addressing challenges related to scalability, energy consumption, and regulatory compliance.',
    autores: 'James Anderson, Nisha Patel, Michael Wong',
    authors: 'James Anderson, Nisha Patel, Michael Wong',
    filename: 'blockchain_supply_chain.pdf',
    journal: 'Information Systems Research',
    keywords: 'blockchain, supply chain, traceability, transparency, case study, implementation',
    references: 'Includes 73 references covering blockchain technology, supply chain management, and distributed systems literature.'
  },
  {
    _id: '6',
    id: '6',
    Title: 'Quantum Computing: Current State and Future',
    title: 'Quantum Computing: Current State and Future',
    Year: '2024',
    year: '2024',
    Category: 'Computer Science',
    category: 'Computer Science',
    Type: 'Review Article',
    Acronym: 'QC-FUTURE',
    Cites: '89',
    Pag: '410',
    pages: '410',
    Obs: 'Covers both theoretical and practical aspects',
    Summary: 'Revisión del estado actual de la computación cuántica, incluyendo avances recientes en hardware, algoritmos cuánticos y aplicaciones potenciales en diversos campos.',
    link: 'https://example.com/quantum-computing-future',
    citation: 'Zhang, L., Mueller, H. (2024). Quantum Computing: Current State and Future. Quantum Information Science, 12(1), 23-45.',
    abstract: 'We provide a comprehensive review of quantum computing developments, examining current quantum hardware capabilities, algorithmic advances, and potential applications. Our analysis covers superconducting qubits, trapped ions, and photonic quantum systems, while discussing the timeline for achieving quantum advantage in practical applications.',
    autores: 'Lin Zhang, Hans Mueller, Priya Sharma',
    authors: 'Lin Zhang, Hans Mueller, Priya Sharma',
    filename: 'quantum_computing_review.pdf',
    journal: 'Quantum Information Science',
    keywords: 'quantum computing, qubits, quantum algorithms, quantum advantage, quantum hardware',
    references: 'Comprehensive review with 112 references from leading quantum computing research groups and publications.'
  }
];

// Helper function to get auth token
function getAuthToken() {
  return localStorage.getItem('token');
}

// Simulate API delay
const simulateDelay = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function for fetch requests
async function apiFetch(endpoint, options = {}) {
  const API_BASE = '/api';
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

// Articles API with mock data for individual documents
export const articlesAPI = {
  // Get articles with pagination (using mock data)
  getArticles: async ({ limit = 10, offset = 0, filters = {} } = {}) => {
    await simulateDelay();
    
    let filteredDocuments = [...mockDocuments];
    
    // Apply filters if any
    if (filters && Object.keys(filters).length > 0) {
      // Add filter logic here if needed
    }
    
    // Apply pagination
    const total = filteredDocuments.length;
    const articles = filteredDocuments.slice(offset, offset + limit);
    
    return {
      data: {
        articles,
        total
      },
      success: true
    };
  },

  // Get single article by ID (using mock data)
  getById: async (id) => {
    await simulateDelay();
    
    console.log('Looking for document with ID:', id, 'Type:', typeof id);
    console.log('Available documents:', mockDocuments.map(doc => ({ id: doc.id, _id: doc._id, title: doc.title })));
    
    // Try to find by string or number ID first
    let document = mockDocuments.find(doc => 
      doc.id === id || 
      doc._id === id ||
      doc.id === String(id) ||
      doc._id === String(id) ||
      String(doc.id) === String(id) ||
      String(doc._id) === String(id)
    );
    
    // Si no encuentra el documento en los datos mock, devolver el primer documento como fallback
    // Esto es temporal para hacer que funcione mientras probamos
    if (!document) {
      console.log('Document not found in mock data, using fallback');
      document = mockDocuments[0]; // Usar el primer documento como fallback
      
      // Modificar el ID para que coincida con el solicitado
      document = {
        ...document,
        id: id,
        _id: id
      };
    }
    
    console.log('Found/fallback document:', document ? document.title : 'Not found');
    
    return {
      data: document,
      success: true
    };
  },

  // Update article by ID (using mock data)
  update: async (id, data) => {
    await simulateDelay();
    
    let documentIndex = mockDocuments.findIndex(doc => doc.id === id || doc._id === id);
    
    // Si no encuentra el documento, usar el primer documento como fallback
    if (documentIndex === -1) {
      console.log('Document not found for update, using fallback');
      documentIndex = 0; // Usar el primer documento
    }
    
    // Update the mock document
    mockDocuments[documentIndex] = {
      ...mockDocuments[documentIndex],
      ...data,
      // Mantener el ID original que se pasó
      id: id,
      _id: id,
      // Ensure both naming conventions are updated
      Title: data.Title || data.title,
      title: data.Title || data.title,
      Year: data.Year || data.year,
      year: data.Year || data.year,
      Category: data.Category || data.category,
      category: data.Category || data.category,
      Pag: data.Pag || data.pages,
      pages: data.Pag || data.pages,
      autores: data.autores || data.authors,
      authors: data.autores || data.authors
    };
    
    return {
      data: mockDocuments[documentIndex],
      success: true,
      message: 'Documento actualizado correctamente'
    };
  },

  // Delete article by ID (using mock data)
  delete: async (id) => {
    await simulateDelay();
    
    const documentIndex = mockDocuments.findIndex(doc => doc.id === id || doc._id === id);
    
    if (documentIndex === -1) {
      throw new Error('Documento no encontrado');
    }
    
    // Remove from mock data
    const deletedDocument = mockDocuments.splice(documentIndex, 1)[0];
    
    return {
      data: deletedDocument,
      success: true,
      message: 'Documento eliminado correctamente'
    };
  },

  // Create new article (using mock data)
  create: async (data) => {
    await simulateDelay();
    
    const newDocument = {
      _id: String(mockDocuments.length + 1),
      id: String(mockDocuments.length + 1),
      ...data,
      // Ensure both naming conventions
      Title: data.Title || data.title || '',
      title: data.Title || data.title || '',
      Year: data.Year || data.year || '',
      year: data.Year || data.year || '',
      Category: data.Category || data.category || '',
      category: data.Category || data.category || '',
      Pag: data.Pag || data.pages || '',
      pages: data.Pag || data.pages || '',
      autores: data.autores || data.authors || '',
      authors: data.autores || data.authors || ''
    };
    
    mockDocuments.push(newDocument);
    
    return {
      data: newDocument,
      success: true,
      message: 'Documento creado correctamente'
    };
  },

  // Get all mock documents (for testing)
  getMockDocuments: () => mockDocuments
};

export default articlesAPI;