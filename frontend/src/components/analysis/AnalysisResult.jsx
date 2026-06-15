import { useState } from 'react';
import ClaimList from './ClaimList.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import VideoInfo from './VideoInfo.jsx';
import ExpandModal from '../common/ExpandModal.jsx';
import ExpandedClaimList from './ExpandedClaimList.jsx';
import ExpandedTranscript from './ExpandedTranscript.jsx';
import ConfidenceGauge from './ConfidenceGauge.jsx';
import VerdictDistribution from './VerdictDistribution.jsx';
import Icon from '../common/Icon.jsx';
import { toPercent } from '../../lib/factCheck.js';

function AnalysisResult({ analysis, currentTime, playerKey, onPlayerReady, onClaimClick, onRerunClaims, onReloadPlayer }) {
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  if (!analysis) return null;

  const videoDataAvailable = !!analysis.video?.title;
  const transcriptionAvailable = !!analysis.transcription;
  const claimsAvailable = analysis.claims && analysis.claims.length > 0;
  const isProcessing = analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED';

  const hasVerdicts = claimsAvailable && analysis.claims.some((c) => c.verdict);
  const hasScore = toPercent(analysis.confidenceScore) !== null;
  const showSynthesis = claimsAvailable && (hasVerdicts || hasScore);

  const validCount = claimsAvailable ? analysis.claims.filter((c) => c.validationStatus === 'VALID').length : 0;
  const claimsCount = claimsAvailable ? analysis.claims.length : 0;

  const handleModalClaimClick = (timestamp) => {
    onClaimClick(timestamp);
    setShowClaimsModal(false);
  };
  const handleModalTranscriptClick = (timestamp) => {
    onClaimClick(timestamp);
    setShowTranscriptModal(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---- Synthèse globale ---- */}
      {showSynthesis && (
        <div className="panel-raised p-6 sm:p-7">
          <div className="mb-5 flex items-center gap-2.5">
            <Icon name="gauge" className="h-5 w-5 text-brand-soft" />
            <h2 className="text-lg font-bold text-ink">Analysis summary</h2>
          </div>
          <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr]">
            {hasScore && (
              <div className="flex justify-center lg:border-r lg:border-line lg:pr-6">
                <ConfidenceGauge score={analysis.confidenceScore} />
              </div>
            )}
            <div className="space-y-5">
              {hasVerdicts ? (
                <VerdictDistribution claims={analysis.claims} />
              ) : (
                <p className="text-sm text-muted">
                  Fact-checking wasn't run. Enable it to get a verdict per claim and a global
                  confidence score.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Metric icon="sparkle" value={claimsCount} label={`claim${claimsCount > 1 ? 's' : ''}`} />
                <Metric icon="shield" value={validCount} label="validated" tone="text-emerald-300" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Informations du contenu ---- */}
      {videoDataAvailable && <VideoInfo video={analysis.video} />}

      {/* ---- Lecteur + Affirmations ---- */}
      {analysis.videoId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Lecteur */}
          <div className="panel overflow-hidden p-2.5">
            <div className="relative overflow-hidden rounded-xl">
              <YouTubePlayer key={playerKey} videoId={analysis.videoId} onPlayerReady={onPlayerReady} />
              <button
                onClick={onReloadPlayer}
                className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-base/70 px-2.5 py-1.5 text-xs font-medium text-muted backdrop-blur-md transition-colors hover:border-brand/40 hover:text-ink"
                title="Reload the video player"
              >
                <Icon name="refresh" className="h-3.5 w-3.5" />
                Reload
              </button>
            </div>
          </div>

          {/* Affirmations */}
          <div className="panel flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-ink">Claims</h2>
                {claimsAvailable && (
                  <span className="rounded-md border border-line bg-elevated/60 px-2 py-0.5 font-mono text-xs text-muted">
                    {claimsCount}
                  </span>
                )}
                {claimsAvailable && (
                  <button
                    onClick={() => setShowClaimsModal(true)}
                    className="btn-ghost !p-2"
                    title="Expand the claims list"
                  >
                    <Icon name="expand" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={onRerunClaims}
                disabled={isProcessing}
                className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
                title="Re-run claim extraction"
              >
                {isProcessing ? <LoadingSpinner /> : <Icon name="refresh" className="h-4 w-4" />}
                <span className="hidden sm:inline">Re-run</span>
              </button>
            </div>

            <div className="flex-grow">
              {isProcessing && !claimsAvailable && (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center text-muted">
                  <LoadingSpinner />
                  <p className="font-medium">
                    {analysis.status === 'VALIDATING_CLAIMS' ? 'Validating…' : 'Extracting…'}
                  </p>
                </div>
              )}

              {claimsAvailable && (
                <ClaimList claims={analysis.claims} onClaimClick={onClaimClick} currentTime={currentTime} />
              )}

              {!isProcessing && !claimsAvailable && (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-base/20 p-8 text-center">
                  <Icon name="search" className="h-7 w-7 text-faint" />
                  <p className="text-muted">No factual claims were extracted.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Transcription ---- */}
      {transcriptionAvailable && (
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <Icon name="doc" className="h-5 w-5 text-brand-soft" />
            <h2 className="text-lg font-bold text-ink">Transcript</h2>
            <button onClick={() => setShowTranscriptModal(true)} className="btn-ghost !p-2" title="Expand the transcript">
              <Icon name="expand" className="h-4 w-4" />
            </button>
          </div>
          <div className="scrollbar-custom max-h-60 overflow-y-auto rounded-xl border border-line bg-base/40 p-4 leading-relaxed text-muted whitespace-pre-wrap">
            {analysis.transcription.fullText}
          </div>
        </div>
      )}

      {/* ---- Modales ---- */}
      <ExpandModal
        isOpen={showClaimsModal}
        onClose={() => setShowClaimsModal(false)}
        title="Claims — Detailed view"
        type="claims"
      >
        <ExpandedClaimList claims={analysis.claims} onClaimClick={handleModalClaimClick} currentTime={currentTime} />
      </ExpandModal>

      <ExpandModal
        isOpen={showTranscriptModal}
        onClose={() => setShowTranscriptModal(false)}
        title="Transcript — Detailed view"
        type="transcript"
      >
        <ExpandedTranscript transcription={analysis.transcription} onTimestampClick={handleModalTranscriptClick} />
      </ExpandModal>
    </div>
  );
}

function Metric({ icon, value, label, tone = 'text-ink' }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-base/40 px-3 py-2">
      <Icon name={icon} className="h-4 w-4 text-faint" />
      <span className={`font-mono text-sm font-semibold ${tone}`}>{value}</span>
      <span className="text-xs text-faint">{label}</span>
    </div>
  );
}

export default AnalysisResult;
