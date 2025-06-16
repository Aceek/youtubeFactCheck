import { useState, useCallback, useEffect, useRef } from 'react';
import { createAnalysis, fetchAnalysis } from '../api/analysisApi';

export function useAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const pollingIntervalRef = useRef(null);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
  
  const pollAnalysis = useCallback(async (id) => {
    try {
      const updatedAnalysis = await fetchAnalysis(id);
      setAnalysis(updatedAnalysis);

      if (updatedAnalysis.status === 'COMPLETE' || updatedAnalysis.status === 'FAILED') {
        setIsLoading(false);
        stopPolling();
      }
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      stopPolling();
    }
  }, []);

  const startAnalysis = useCallback(async (url, provider) => {
    stopPolling(); // Arrête tout polling précédent
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const initialAnalysis = await createAnalysis(url, provider);
      setAnalysis(initialAnalysis);

      // Si l'analyse est déjà complète (cache hit), on s'arrête là.
      if(initialAnalysis.status === 'COMPLETE') {
        setIsLoading(false);
        return;
      }

      // Sinon, on commence le polling.
      pollingIntervalRef.current = setInterval(() => {
        pollAnalysis(initialAnalysis.id);
      }, 5000);

    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  }, [pollAnalysis]);

  // Nettoyage de l'intervalle si le composant est démonté
  useEffect(() => {
    return () => stopPolling();
  }, []);

  return { analysis, isLoading, error, startAnalysis };
}