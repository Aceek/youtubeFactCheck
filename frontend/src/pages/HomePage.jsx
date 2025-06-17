import { useState } from 'react'; // Importer useState
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import AnalysisStatus from '../components/analysis/AnalysisStatus';
import { useAnalysis } from '../hooks/useAnalysis';

function HomePage() {
  const { analysis, isLoading, error, startAnalysis, rerunClaimExtraction } = useAnalysis();
  const [player, setPlayer] = useState(null);
  const [playerKey, setPlayerKey] = useState(0); // <-- NOUVEL ÉTAT

  const isProcessing = isLoading || (analysis && analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED');

  const handleRerun = () => {
    if (analysis) {
      rerunClaimExtraction(analysis.id);
    }
  };

  const handlePlayerReady = (eventTarget) => {
    setPlayer(eventTarget);
  };

  const handleClaimClick = (timestamp) => {
    if (player) {
      player.seekTo(timestamp);
      player.playVideo();
    }
  };

  // --- NOUVELLE FONCTION ---
  const handleReloadPlayer = () => {
    setPlayer(null); // On réinitialise l'instance du player
    setPlayerKey(prevKey => prevKey + 1); // On change la clé pour forcer le re-montage
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <AnalysisForm onSubmit={startAnalysis} isLoading={isLoading} />
      
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 animate-fade-in" role="alert">
          <p className="font-bold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}
      {isProcessing && analysis && ( <AnalysisStatus analysis={analysis} /> )}

      {/* Affiche le résultat final si l'analyse est terminée */}
      {analysis && analysis.status === 'COMPLETE' && (
        <AnalysisResult
          analysis={analysis}
          playerKey={playerKey} // On passe la clé
          onPlayerReady={handlePlayerReady}
          onClaimClick={handleClaimClick}
          onRerunClaims={handleRerun} // On passe la fonction
          onReloadPlayer={handleReloadPlayer} // On passe la fonction de rechargement
          isProcessing={isProcessing} // Et l'état de chargement
        />
      )}
    </div>
  );
}

export default HomePage;