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

  const startAnalysis = useCallback(async (url, provider, withValidation) => { // Ajout du paramètre
    stopPolling();
    setIsLoading(true); // Seul le chargement initial utilise cet état
    setError(null);
    setAnalysis(null);

    try {
      // On passe le paramètre à l'appel API
      const initialAnalysis = await createAnalysis(url, provider, withValidation);
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

  const rerunClaimExtraction = useCallback(async (id, withValidation) => { // <-- Accepte le paramètre
    stopPolling();
    setError(null);
    try {
      setAnalysis(prevAnalysis => ({
        ...prevAnalysis,
        // On passe directement à VALIDATING si c'est activé, sinon EXTRACTING
        status: withValidation ? 'VALIDATING_CLAIMS' : 'EXTRACTING_CLAIMS',
        claims: [],
      }));

      // On passe la valeur à l'API
      await reRunClaims(id, withValidation);

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