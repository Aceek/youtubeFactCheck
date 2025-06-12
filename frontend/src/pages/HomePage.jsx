import { useState } from 'react';
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import { createAnalysis } from '../api/analysisApi';

function HomePage() {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartAnalysis = async (url, provider) => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const result = await createAnalysis(url, provider);
      setAnalysis(result);
    } catch (err) {
      setError(err.message || "Une erreur inconnue est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <AnalysisForm 
        onSubmit={handleStartAnalysis} 
        isLoading={isLoading} 
      />
      {error && (
        <div className="mt-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          <p className="font-bold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}
      {analysis && (
        <div className="mt-8">
          <AnalysisResult analysis={analysis} />
        </div>
      )}
    </div>
  );
}

export default HomePage;