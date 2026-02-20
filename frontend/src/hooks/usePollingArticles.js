import { useEffect, useRef } from 'react';
import { articlesAPI } from '../api/api';

/**
 * Hook que hace polling periódico de artículos con status "processing"
 * Llama al callback solo cuando detecta cambios de status
 */
export const usePollingArticles = (onChanged, pollInterval = 3000) => {
  const lastStatusMapRef = useRef({});
  const pollingTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const poll = async () => {
      try {
        const response = await articlesAPI.getArticles({
          limit: 500,
          offset: 0,
          filters: { mode: 'all' },
        });

        if (!isMountedRef.current) return;

        const articles = response.data.articles;
        
        // Detectar si algún artículo cambió de status
        let hasChanges = false;
        const currentStatusMap = {};
        
        for (const article of articles) {
          currentStatusMap[article._id] = article.status;
          
          // Comparar con estado anterior
          if (lastStatusMapRef.current[article._id] !== article.status) {
            console.log(`Articulo ${article._id}: ${lastStatusMapRef.current[article._id] || 'nuevo'} -> ${article.status}`);
            hasChanges = true;
          }
        }

        // Actualizar referencia
        lastStatusMapRef.current = currentStatusMap;

        // Llamar callback solo si hay cambios
        if (hasChanges) {
          console.log('Cambios detectados');
          onChanged?.();
        }

        // Contar artículos en procesamiento
        const processingCount = articles.filter(a => a.status === 'processing').length;
        console.log(`Articulos en procesamiento: ${processingCount}`);

        // Continuar polling si hay artículos en procesamiento
        if (processingCount > 0 && isMountedRef.current) {
          pollingTimeoutRef.current = setTimeout(poll, pollInterval);
        }
      } catch (error) {
        console.error('Error en polling:', error);
        // Reintentar aunque haya error
        if (isMountedRef.current) {
          pollingTimeoutRef.current = setTimeout(poll, pollInterval);
        }
      }
    };

    // Iniciar polling
    poll();

    return () => {
      isMountedRef.current = false;
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [onChanged, pollInterval]);
};
