import { useState, useEffect } from 'react';
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import AnalysisStatus from '../components/analysis/AnalysisStatus';
import Icon from '../components/common/Icon';
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

  const handleReloadPlayer = () => setPlayerKey((prevKey) => prevKey + 1);

  // L'analyse est en cours tant que son statut n'est ni COMPLETE ni FAILED.
  const isAnalysisRunning = analysis && analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED';
  const showResults = !!analysis;

  return (
    <div className="space-y-8">
      {/* Hero — visible uniquement avant la première analyse */}
      {!analysis && (
        <section className="animate-rise pt-2 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-elevated/50 px-3 py-1.5">
            <Icon name="sparkle" className="h-3.5 w-3.5 text-brand-soft" />
            <span className="text-xs font-medium text-muted">AI-assisted analysis pipeline</span>
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            From link to{' '}
            <span className="bg-gradient-to-r from-brand-soft via-brand to-live bg-clip-text text-transparent">
              verdict
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted sm:text-lg">
            Transcription, factual claim extraction, validation, and fact-checking — every statement
            is pinned to the second and scored for confidence.
          </p>
        </section>
      )}

      <AnalysisForm
        onSubmit={handleFormSubmit}
        isLoading={isLoading}
        runValidation={runValidationOnSubmit}
        setRunValidation={setRunValidationOnSubmit}
        runFactChecking={runFactCheckingOnSubmit}
        setRunFactChecking={setRunFactCheckingOnSubmit}
      />

      {error && (
        <div
          className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200 animate-fade-in"
          role="alert"
        >
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <p className="font-semibold text-rose-100">Something went wrong</p>
            <p className="text-sm text-rose-200/90">{error}</p>
          </div>
        </div>
      )}

      {isAnalysisRunning && (
        <AnalysisStatus
          analysis={analysis}
          withValidation={runValidationOnSubmit}
          withFactChecking={runFactCheckingOnSubmit}
        />
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
