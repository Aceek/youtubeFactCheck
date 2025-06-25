import { useState, useEffect } from 'react';
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import AnalysisStatus from '../components/analysis/AnalysisStatus';
import { useAnalysis } from '../hooks/useAnalysis';

function HomePage() {
  const { analysis, isLoading, error, startAnalysis, rerunClaimExtraction } = useAnalysis();
  const [player, setPlayer] = useState(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [runValidationOnSubmit, setRunValidationOnSubmit] = useState(false);
  const [runFactCheckingOnSubmit, setRunFactCheckingOnSubmit] = useState(false);

  const handleRerun = () => {
    if (analysis) {
      rerunClaimExtraction(analysis.id, runValidationOnSubmit, runFactCheckingOnSubmit);
    }
  };
  
  const handleFormSubmit = (url, provider, withValidation, withFactChecking) => {
    setRunValidationOnSubmit(withValidation);
    setRunFactCheckingOnSubmit(withFactChecking);
    startAnalysis(url, provider, withValidation, withFactChecking);
  };

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(async () => {
      if (player && typeof player.getCurrentTime === 'function') {
        const time = await player.getCurrentTime();
        setCurrentTime(time);
      }
    }, 500);

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

  // NOUVELLE LOGIQUE D'AFFICHAGE
  // L'analyse est en cours tant que son statut n'est ni COMPLETE ni FAILED.
  const isAnalysisRunning = analysis && analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED';
  const showResults = !!analysis; // On affiche la zone de résultat dès qu'on a un objet 'analysis'.

  return (
    <div className="max-w-4xl lg:max-w-7xl mx-auto space-y-8">
      <AnalysisForm
        onSubmit={handleFormSubmit}
        isLoading={isLoading} // Le bouton est "loading" tant que le processus global est en cours
        runValidation={runValidationOnSubmit}
        setRunValidation={setRunValidationOnSubmit}
        runFactChecking={runFactCheckingOnSubmit}
        setRunFactChecking={setRunFactCheckingOnSubmit}
      />
      
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 animate-fade-in" role="alert">
          <p className="font-bold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      {/* Le statut est maintenant affiché PENDANT que les résultats se construisent */}
      {isAnalysisRunning && (
        <AnalysisStatus analysis={analysis} withValidation={runValidationOnSubmit} withFactChecking={runFactCheckingOnSubmit} />
      )}
      
      {showResults && (
        <AnalysisResult
          analysis={analysis}
          currentTime={currentTime}
          playerKey={playerKey}
          onPlayerReady={handlePlayerReady}
          onClaimClick={handleClaimClick}
          onRerunClaims={handleRerun}
          onReloadPlayer={handleReloadPlayer}
        />
      )}
    </div>
  );
}

export default HomePage;