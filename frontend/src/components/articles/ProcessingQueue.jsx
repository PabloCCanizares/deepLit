import React, { useState, useEffect, useRef } from 'react';
import { articlesAPI } from '../../api/api';
import '../../styles/articles/ProcessingQueue.css';

const ProcessingQueue = ({ isOpen, onClose }) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  // Cargar cola
  const loadQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await articlesAPI.getQueue();
      setQueue(response.data.queue || []);
    } catch (err) {
      setError(err.message || 'Error al cargar la cola');
    } finally {
      setLoading(false);
    }
  };

  // Suscribirse a eventos SSE cuando el modal está abierto
  useEffect(() => {
    if (!isOpen) return;

    // Cargar cola inicialmente cuando se abre el modal
    loadQueue();

    // Suscribirse a eventos SSE
    const es = articlesAPI.subscribeEvents({
      onArticleReady: (data) => {
        console.log('ProcessingQueue: artículo listo', data);
        loadQueue(); // Recargar la cola cuando un artículo esté listo
      },
      onArticleError: (data) => {
        console.log('ProcessingQueue: error en artículo', data);
        loadQueue(); // Recargar la cola cuando hay un error
      },
      onError: () => {
        console.warn('ProcessingQueue: error en SSE');
      }
    });

    eventSourceRef.current = es;

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen]);

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

  const processingCount = queue.filter(q => q.status === 'processing').length;
  const errorCount = queue.filter(q => q.status === 'error').length;

  return (
    <div className="processing-queue-overlay" onClick={onClose}>
      <div className="processing-queue-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pq-header">
          <div className="pq-title-section">
            <h2 className="pq-title">Cola de Procesamiento</h2>
            <div className="pq-stats">
              <span className="pq-stat processing">
                <span className="pq-dot processing"></span>
                Procesando: {processingCount}
              </span>
              {errorCount > 0 && (
                <span className="pq-stat error">
                  <span className="pq-dot error"></span>
                  Errores: {errorCount}
                </span>
              )}
            </div>
          </div>
          <button className="pq-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="pq-controls">
          <button 
            className="pq-btn-refresh" 
            onClick={loadQueue}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {/* Content */}
        <div className="pq-content">
          {error && (
            <div className="pq-error-message">
              <p>⚠️ {error}</p>
            </div>
          )}

          {!error && queue.length === 0 && !loading && (
            <div className="pq-empty">
              <div className="pq-empty-icon">✓</div>
              <p>No hay artículos en procesamiento</p>
              <span className="pq-empty-hint">Todos tus artículos están listos</span>
            </div>
          )}

          {!error && queue.length > 0 && (
            <div className="pq-items-list">
              {queue.map((item) => (
                <div key={item._id} className={`pq-item pq-item-${item.status}`}>
                  <div className="pq-item-status">
                    {item.status === 'error' && (
                      <div className="pq-error-icon">!</div>
                    )}
                  </div>

                  <div className="pq-item-content">
                    <h3 className="pq-item-title">{item.title || 'Sin título'}</h3>
                    {item.status === 'processing' && (
                      <p className="pq-item-status-text">Procesando PDF...</p>
                    )}
                    {item.status === 'error' && (
                      <p className="pq-item-error-message">
                        Error: {item.error_message || 'Error desconocido'}
                      </p>
                    )}
                  </div>

                  <div className="pq-item-timestamp">
                    {new Date(item.created_at).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pq-footer">
          <span className="pq-total">Total en cola: {queue.length}</span>
        </div>
      </div>
    </div>
  );
};

export default ProcessingQueue;
