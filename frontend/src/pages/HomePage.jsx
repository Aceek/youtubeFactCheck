import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import { useAnalysis } from '../hooks/useAnalysis'; // NOUVEAU

function HomePage() {
  const { analysis, isLoading, error, startAnalysis } = useAnalysis();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <AnalysisForm 
        onSubmit={startAnalysis} // On passe directement la fonction du hook
        isLoading={isLoading} 
      />

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 animate-fade-in" role="alert">
          <p className="font-bold">Échec de l'analyse :</p>
          <p>{error}</p>
        </div>
      )}

      {/* Le résultat ne s'affiche que si une analyse est terminée et disponible */}
      {analysis && (
        <AnalysisResult analysis={analysis} />
      )}
    </div>
  );
}

export default HomePage;