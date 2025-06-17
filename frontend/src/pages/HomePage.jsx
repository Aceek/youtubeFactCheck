import { useState } from 'react'; // Importer useState
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import AnalysisStatus from '../components/analysis/AnalysisStatus';
import { useAnalysis } from '../hooks/useAnalysis';
import VideoInfo from '../components/analysis/VideoInfo';

function HomePage() {
  const { analysis, isLoading, error, startAnalysis, rerunClaimExtraction } = useAnalysis();
  const [player, setPlayer] = useState(null);
  const [playerKey, setPlayerKey] = useState(0);

  const handleRerun = () => {
    if (analysis) {
      rerunClaimExtraction(analysis.id);
    }
  };

  const handlePlayerReady = (eventTarget) => setPlayer(eventTarget);

  const handleClaimClick = (timestamp) => {
    if (player) {
      player.seekTo(timestamp);
      player.playVideo();
    }
  };

  const handleReloadPlayer = () => setPlayerKey(prevKey => prevKey + 1);

  // --- CORRECTION CLÉ DE LA LOGIQUE D'AFFICHAGE ---
  // On affiche le spinner global SEULEMENT pendant le tout premier chargement.
  const showGlobalStatus = isLoading && !analysis?.transcription;
  // On affiche la page de résultats DÈS qu'une transcription est disponible.
  const showResults = analysis?.transcription;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <AnalysisForm onSubmit={startAnalysis} isLoading={isLoading} />
      
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 animate-fade-in" role="alert">
          <p className="font-bold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      {showGlobalStatus && <AnalysisStatus analysis={analysis} />}

      {showResults && (
        <>
          {/* Avertissement pour les erreurs non-critiques */}
          {analysis.errorMessage && (
            <div className="p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg text-yellow-300" role="alert">
              <p className="font-bold">Avertissement :</p>
              <p>{analysis.errorMessage}</p>
            </div>
          )}
          <VideoInfo video={analysis.video} />
          <AnalysisResult
            analysis={analysis}
            playerKey={playerKey}
            onPlayerReady={handlePlayerReady}
            onClaimClick={handleClaimClick}
            onRerunClaims={handleRerun}
            onReloadPlayer={handleReloadPlayer}
          />
        </>
      )}
    </div>
  );
}

export default HomePage;