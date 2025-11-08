import React, { useRef, useEffect } from 'react';
import { uploadAPI } from '../../api/api';
import '../../styles/documents/UploadOverlay.css';

const UploadOverlay = ({ isOpen, onClose, onUploadSuccess }) => {
  // Referencias para los inputs de archivo
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const excelInputRef = useRef(null);

  // Cerrar con ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
      alert('Error: Solo se permiten archivos PDF');
      event.target.value = '';
      return;
    }

    // Cerrar overlay inmediatamente
    onClose();

    // Iniciar la carga en background
    try {
      await uploadAPI.uploadPDF(file);
      if (onUploadSuccess) {
        onUploadSuccess('Archivo subido correctamente');
      }
    } catch (error) {
      if (onUploadSuccess) {
        onUploadSuccess(`Error al subir archivo: ${error.message}`);
      }
    } finally {
      event.target.value = '';
    }
  };

  const handleFolderUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('Error: No se encontraron archivos PDF en la carpeta');
      event.target.value = '';
      return;
    }

    // Cerrar overlay inmediatamente
    onClose();

    // Iniciar la carga en background
    try {
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        await uploadAPI.uploadPDF(file);
      }
      
      if (onUploadSuccess) {
        onUploadSuccess(`${pdfFiles.length} archivo(s) subido(s) correctamente`);
      }
    } catch (error) {
      if (onUploadSuccess) {
        onUploadSuccess(`Error al subir archivos: ${error.message}`);
      }
    } finally {
      event.target.value = '';
    }
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      alert('Error: Solo se permiten archivos Excel');
      event.target.value = '';
      return;
    }

    // Cerrar overlay inmediatamente
    onClose();

    // Iniciar la carga en background
    try {
      await uploadAPI.uploadExcel(file);
      if (onUploadSuccess) {
        onUploadSuccess('Archivo subido correctamente');
      }
    } catch (error) {
      if (onUploadSuccess) {
        onUploadSuccess(`Error al subir archivo: ${error.message}`);
      }
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="upload-overlay" onClick={onClose}>
      <div className="upload-overlay-content" onClick={(e) => e.stopPropagation()}>
        {/* Inputs ocultos */}
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
          accept=".xlsx"
          onChange={handleExcelUpload}
        />

        {/* Botón de cerrar */}
        <button className="upload-overlay-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Las 3 tarjetas con animación de burbujas */}
        <div className="upload-options-grid">
          {/* Subir Archivo */}
          <div 
            className="upload-card bubble-float"
            style={{ animationDelay: '0.1s' }}
            onClick={() => handleUploadOption('file')}
          >
            <div className="upload-card-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 15L12 12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="upload-card-title">Subir Archivo</h3>
            <div className="upload-card-badge">PDF</div>
          </div>

          {/* Subir Carpeta */}
          <div 
            className="upload-card bubble-float"
            style={{ animationDelay: '0.3s' }}
            onClick={() => handleUploadOption('folder')}
          >
            <div className="upload-card-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 14V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 12L12 10L14 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="upload-card-title">Subir Carpeta</h3>
            <div className="upload-card-badge">Múltiples PDF</div>
          </div>

          {/* Subir Excel */}
          <div 
            className="upload-card bubble-float"
            style={{ animationDelay: '0.5s' }}
            onClick={() => handleUploadOption('excel')}
          >
            <div className="upload-card-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="8" y="12" width="8" height="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 15H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 12V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="upload-card-title">Subir Excel</h3>
            <div className="upload-card-badge">XLSX</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadOverlay;
