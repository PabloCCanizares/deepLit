import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadAPI, statsAPI } from '../api/api';
import '../styles/documents/UploadDocuments.css';

const UploadDocuments = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDocuments: 0
  });
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Referencias para los inputs de archivo
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const excelInputRef = useRef(null);

  // Obtener estadísticas reales usando la misma API que el Dashboard
  const fetchStats = async () => {
    try {
      // Usar la misma API que el Dashboard
      const response = await statsAPI.getStats();
      const statsData = response.data;

      setStats({
        totalDocuments: statsData?.document_count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Valores por defecto si hay error
      setStats({
        totalDocuments: 0
      });
    }
  };

  // Cambiar el fondo del body a blanco cuando se monta el componente
  useEffect(() => {
    document.body.classList.add('upload-page-body');
    document.body.style.backgroundColor = 'white';
    
    // Obtener estadísticas
    fetchStats();
    
    // Limpiar cuando se desmonta el componente
    return () => {
      document.body.classList.remove('upload-page-body');
      document.body.style.backgroundColor = '';
    };
  }, []);

  const handleUploadOption = (option) => {
    switch(option) {
      case 'file':
        fileInputRef.current?.click();
        break;
      case 'folder':
        folderInputRef.current?.click();
        break;
      case 'excel':
        excelInputRef.current?.click();
        break;
      default:
        console.log('Opción no reconocida');
    }
  };

  const handleSingleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadStatus('Error: Solo se permiten archivos PDF');
      return;
    }

    setUploading(true);
    setUploadStatus('Subiendo archivo...');

    try {
      // Usar exactamente la misma función que el Dashboard
      await uploadAPI.uploadPDF(file);
      setUploadStatus('Archivo subido correctamente');
      // Actualizar estadísticas después de subir
      fetchStats();
      // Redirigir a documentos después de un breve delay
      // setTimeout(() => {
      //   navigate('/documents');
      // }, 2000);
    } catch (error) {
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setUploading(false);
      // Limpiar el input
      event.target.value = '';
    }
  };

  const handleFolderUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Filtrar solo archivos PDF
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      setUploadStatus('Error: No se encontraron archivos PDF en la carpeta');
      return;
    }

    setUploading(true);
    setUploadStatus(`Subiendo ${pdfFiles.length} archivos...`);

    try {
      // Subir cada archivo usando la misma función que el Dashboard (en bucle)
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        setUploadStatus(`Subiendo archivo ${i + 1} de ${pdfFiles.length}: ${file.name}`);
        await uploadAPI.uploadPDF(file);
      }
      
      setUploadStatus(`${pdfFiles.length} archivos subidos correctamente`);
      // Actualizar estadísticas después de subir
      fetchStats();
      // Redirigir a documentos después de un breve delay
      // setTimeout(() => {
      //   navigate('/documents');
      // }, 2000);
    } catch (error) {
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setUploading(false);
      // Limpiar el input
      event.target.value = '';
    }
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setUploadStatus('Error: Solo se permiten archivos Excel (.xlsx, .xls)');
      return;
    }

    setUploading(true);
    setUploadStatus('Subiendo archivo Excel...');

    try {
      // TODO: Por implementar - funcionalidad de Excel pendiente
      // await uploadAPI.uploadExcel(file);
      setUploadStatus('Funcionalidad de Excel - Por implementar');
      
      // Simular delay para mostrar el mensaje
      setTimeout(() => {
        setUploadStatus('');
      }, 3000);
    } catch (error) {
      setUploadStatus(`Error: ${error.message}`);
    } finally {
      setUploading(false);
      // Limpiar el input
      event.target.value = '';
    }
  };

  return (
    <div className="upload-documents-container">
      {/* Inputs ocultos para subir archivos */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pdf"
        onChange={handleSingleFileUpload}
      />
      <input
        type="file"
        ref={folderInputRef}
        style={{ display: 'none' }}
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderUpload}
      />
      <input
        type="file"
        ref={excelInputRef}
        style={{ display: 'none' }}
        accept=".xlsx,.xls"
        onChange={handleExcelUpload}
      />

      {/* Header Panel */}
      <div className="header-panel">
        <div className="header-content">
          <div className="header-info">
            <h1 className="header-title">Subir Documentos</h1>
            <p className="header-subtitle">
              Selecciona el método de carga que prefieras
            </p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-number">{stats.totalDocuments}</span>
              <span className="stat-label">Total documentos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Estado de upload */}
      {(uploading || uploadStatus) && (
        <div className="upload-status">
          {uploading && (
            <div className="upload-progress">
              <div className="spinner"></div>
            </div>
          )}
          <p className={`upload-message ${uploadStatus.includes('Error') ? 'error' : 'success'}`}>
            {uploadStatus}
          </p>
        </div>
      )}

      {/* Upload Options */}
      <div className="upload-options-container">
        <div className="upload-options-grid">
          {/* Subir Archivo */}
          <div 
            className={`upload-option-card ${uploading ? 'disabled' : ''}`}
            onClick={() => !uploading && handleUploadOption('file')}
          >
            <div className="upload-option-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 15L12 12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="upload-option-title">Subir Archivo</h3>
            <p className="upload-option-description">
              Sube un documento PDF individual para su análisis automático
            </p>
            <div className="upload-option-badge">PDF</div>
          </div>

          {/* Subir Carpeta */}
          <div 
            className={`upload-option-card ${uploading ? 'disabled' : ''}`}
            onClick={() => !uploading && handleUploadOption('folder')}
          >
            <div className="upload-option-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 14V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 12L12 10L14 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="upload-option-title">Subir Carpeta</h3>
            <p className="upload-option-description">
              Sube múltiples documentos PDF desde una carpeta completa
            </p>
            <div className="upload-option-badge">Múltiples PDF</div>
          </div>

          {/* Subir Excel */}
          <div 
            className={`upload-option-card ${uploading ? 'disabled' : ''}`}
            onClick={() => !uploading && handleUploadOption('excel')}
          >
            <div className="upload-option-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="8" y="12" width="8" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 15H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 12V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="upload-option-title">Subir Excel</h3>
            <p className="upload-option-description">
              Importa documentos desde un archivo Excel con datos estructurados
            </p>
            <div className="upload-option-badge">XLSX</div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="upload-info-section">
          <div className="upload-info-card">
            <h4>Formatos soportados</h4>
            <ul>
              <li><strong>PDF:</strong> Documentos científicos y académicos</li>
              <li><strong>Excel:</strong> Archivos .xlsx y .xls con estructura definida</li>
              <li><strong>Carpetas:</strong> Múltiples archivos PDF organizados</li>
            </ul>
          </div>
          <div className="upload-info-card">
            <h4>Procesamiento automático</h4>
            <ul>
              <li>Extracción automática de metadatos</li>
              <li>Análisis de contenido científico</li>
              <li>Identificación de citas y referencias</li>
              <li>Búsqueda automática en OpenAlex para completar información</li>
              <li>Cola de completado para documentos con campos faltantes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDocuments;