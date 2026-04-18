import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { articlesAPI } from '../../api/index.js';
import { useArticlesEvents } from '../../hooks/useArticlesEvents';
import { invalidateOpenAlexMembershipQueries } from '../../utils/openalexMembershipQueries';
import '../../styles/articles/ProcessingQueue.css';

function formatQueueTimestamp(value) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

const ProcessingQueue = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [removingIds, setRemovingIds] = useState(new Set());
  const reloadTimeoutRef = useRef(null);
  const loadingRef = useRef(false);

  const loadQueue = useCallback(async () => {
    if (loadingRef.current) return;

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      const response = await articlesAPI.getQueue();
      setQueue(response?.data?.queue || []);
    } catch (err) {
      setError(err.message || 'Error al cargar la cola');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const scheduleQueueReload = useCallback(() => {
    if (reloadTimeoutRef.current) return;

    reloadTimeoutRef.current = setTimeout(() => {
      reloadTimeoutRef.current = null;
      loadQueue();
    }, 400);
  }, [loadQueue]);

  useEffect(() => {
    if (!isOpen) return undefined;

    loadQueue();

    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
  }, [isOpen, loadQueue]);

  useArticlesEvents({
    onArticleReady: scheduleQueueReload,
    onArticleError: scheduleQueueReload,
    onError: () => {
      console.warn('ProcessingQueue: error en SSE');
    }
  }, isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleRemoveError = async (itemId) => {
    setRemovingIds(prev => new Set(prev).add(itemId));
    try {
      await articlesAPI.delete(itemId);
      await Promise.all([
        loadQueue(),
        invalidateOpenAlexMembershipQueries(queryClient),
      ]);
    } catch (err) {
      console.error('Error eliminando item de la cola:', err);
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  if (!isOpen) return null;

  const processingCount = queue.filter(q => q.status === 'processing').length;
  const errorCount = queue.filter(q => q.status === 'error').length;
  const hasActiveQueue = processingCount > 0;
  const hasErrorsOnly = processingCount === 0 && errorCount > 0;

  return (
    <div className="processing-queue-overlay" onClick={onClose}>
      <div className="processing-queue-modal" onClick={(e) => e.stopPropagation()}>
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
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="pq-controls">
          <button className="pq-btn-refresh" onClick={loadQueue} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        <div className="pq-content">
          {error && (
            <div className="pq-error-message">
              <p>[!] {error}</p>
            </div>
          )}

          {!error && queue.length === 0 && !loading && (
            <div className="pq-empty">
              <div className="pq-empty-icon">OK</div>
              <p>No hay artículos en procesamiento</p>
              <span className="pq-empty-hint">Todos tus artículos están listos</span>
            </div>
          )}

          {!error && queue.length > 0 && (
            <div className="pq-items-list">
              {queue.map((item) => (
                <div key={item._id} className={`pq-item pq-item-${item.status}`}>
                  <div className="pq-item-status">
                    {item.status === 'error' && <div className="pq-error-icon">!</div>}
                  </div>

                  <div className="pq-item-content">
                    <h3 className="pq-item-title">{item.title || 'Sin título'}</h3>
                    {item.status === 'processing' && <p className="pq-item-status-text">Procesando PDF...</p>}
                    {item.status === 'error' && (
                      <p className="pq-item-error-message">Error: {item.error_message || 'Error desconocido'}</p>
                    )}
                  </div>

                  <div className="pq-item-timestamp">
                    {formatQueueTimestamp(item.created_at)}
                  </div>

                  {item.status === 'error' && (
                    <button
                      className="pq-item-remove"
                      onClick={() => handleRemoveError(item._id)}
                      disabled={removingIds.has(item._id)}
                      title="Eliminar de la cola"
                    >
                      {removingIds.has(item._id) ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10">
                            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                          </circle>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pq-footer">
          <span className="pq-total">
            {hasActiveQueue && `En procesamiento: ${processingCount}`}
            {hasActiveQueue && errorCount > 0 && ` · Errores pendientes: ${errorCount}`}
            {hasErrorsOnly && `Sin cola activa · Errores pendientes: ${errorCount}`}
            {!hasActiveQueue && errorCount === 0 && 'Sin cola activa'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProcessingQueue;
