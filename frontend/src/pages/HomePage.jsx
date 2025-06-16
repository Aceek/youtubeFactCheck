import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import AnalysisStatus from '../components/analysis/AnalysisStatus'; // NOUVEAU
import { useAnalysis } from '../hooks/useAnalysis';

function HomePage() {
  const { analysis, isLoading, error, startAnalysis } = useAnalysis();

  const isProcessing = isLoading || (analysis && analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED');

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Le formulaire est toujours visible */}
      <AnalysisForm 
        onSubmit={startAnalysis} 
        isLoading={isLoading} 
      />
      
      {/* Affiche une erreur s'il y en a une */}
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 animate-fade-in" role="alert">
          <p className="font-bold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      {/* Affiche le suivi d'état si une analyse est en cours */}
      {isProcessing && analysis && (
         <AnalysisStatus analysis={analysis} />
      )}

      {/* Affiche le résultat final si l'analyse est terminée avec succès */}
      {analysis && analysis.status === 'COMPLETE' && (
        <AnalysisResult analysis={analysis} />
      )}
    </div>
  );
}

export default HomePage;