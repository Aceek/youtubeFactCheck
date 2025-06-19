import { useState, useEffect } from 'react';
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import AnalysisStatus from '../components/analysis/AnalysisStatus';
import { useAnalysis } from '../hooks/useAnalysis';
import VideoInfo from '../components/analysis/VideoInfo';

function HomePage() {
  const { analysis, isLoading, error, startAnalysis, rerunClaimExtraction } = useAnalysis();
  const [player, setPlayer] = useState(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  // --- NOUVEAU : On a besoin de l'état du toggle ici aussi ---
  // Pour plus de simplicité, on le gère ici plutôt que dans AnalysisForm.
  // Mais la meilleure approche serait un "state management" global (Contexte, Zustand, etc.)
  // Pour l'instant, on duplique pour rester simple.
  const [runValidationOnSubmit, setRunValidationOnSubmit] = useState(false);

  const handleRerun = () => {
    if (analysis) {
      // On passe la valeur du toggle au hook
      rerunClaimExtraction(analysis.id, runValidationOnSubmit);
    }
  };
  
  const handleFormSubmit = (url, provider, withValidation) => {
    setRunValidationOnSubmit(withValidation); // On mémorise l'état du toggle
    startAnalysis(url, provider, withValidation);
  };

  // --- NOUVEL EFFET POUR METTRE À JOUR LE TEMPS ---
  useEffect(() => {
    if (!player) return;

    // Met à jour le temps toutes les 500ms
    const interval = setInterval(async () => {
      if (player && typeof player.getCurrentTime === 'function') {
        const time = await player.getCurrentTime();
        setCurrentTime(time);
      }
    }, 500);

    // Nettoyage de l'intervalle quand le composant est démonté ou le player change
    return () => clearInterval(interval);
  }, [player]);

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
    <div className="max-w-4xl lg:max-w-7xl mx-auto space-y-8">
      {/* On passe la nouvelle fonction de soumission */}
      <AnalysisForm
        onSubmit={handleFormSubmit}
        isLoading={isLoading}
        runValidation={runValidationOnSubmit}
        setRunValidation={setRunValidationOnSubmit}
      />
      
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 animate-fade-in" role="alert">
          <p className="font-bold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      {showGlobalStatus && <AnalysisStatus analysis={analysis} withValidation={runValidationOnSubmit} />}

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
            currentTime={currentTime}
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