import { useState, useCallback, useEffect, useRef } from 'react';
import { createAnalysis, fetchAnalysis, reRunClaims } from '../api/analysisApi';

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

      // On arrête le polling et le chargement principal SEULEMENT si l'état est final.
      // PARTIALLY_COMPLETE n'est pas un état final, on continue le polling
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

  const startAnalysis = useCallback(async (url, provider, withValidation, withFactChecking) => { // Ajout des paramètres
    stopPolling();
    setIsLoading(true); // Seul le chargement initial utilise cet état
    setError(null);
    setAnalysis(null);

    try {
      // On passe les paramètres à l'appel API
      const initialAnalysis = await createAnalysis(url, provider, withValidation, withFactChecking);
      setAnalysis(initialAnalysis);

      if (initialAnalysis.status === 'COMPLETE') {
        setIsLoading(false);
        return;
      }

      pollingIntervalRef.current = setInterval(() => {
        pollAnalysis(initialAnalysis.id);
      }, 5000);

    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  }, [pollAnalysis]);

  const rerunClaimExtraction = useCallback(async (id, withValidation, withFactChecking) => { // <-- Accepte les paramètres
    stopPolling();
    setError(null);
    try {
      setAnalysis(prevAnalysis => ({
        ...prevAnalysis,
        // Réinitialiser le statut et le progrès
        status: 'EXTRACTING_CLAIMS',
        progress: 0,
        claims: [],
      }));

      // On passe les valeurs à l'API
      await reRunClaims(id, withValidation, withFactChecking);

      pollingIntervalRef.current = setInterval(() => {
        pollAnalysis(id);
      }, 5000);
    } catch (err) {
      setError(err.message);
    }
  }, [pollAnalysis]);

  useEffect(() => { return () => stopPolling(); }, []);

  // On n'a plus besoin de 'isRerunning'
  return { analysis, isLoading, error, startAnalysis, rerunClaimExtraction };
}