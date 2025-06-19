import ClaimList from './ClaimList.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';

function AnalysisResult({ analysis, playerKey, onPlayerReady, onClaimClick, onRerunClaims, onReloadPlayer }) {
  if (!analysis) return null;

  // On détermine l'état de chargement des claims en se basant sur le statut de l'analyse
  const areClaimsLoading = analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED';

  return (
    <div className="space-y-12">
      {/* Section Lecteur Vidéo et Transcription */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="relative shadow-2xl rounded-xl overflow-hidden border-2 border-cyan-400/30">
            <YouTubePlayer
              key={playerKey}
              videoId={analysis.videoId}
              onPlayerReady={onPlayerReady}
            />
            <button
              onClick={onReloadPlayer}
              className="absolute top-3 right-3 text-xs bg-black/60 hover:bg-cyan-500/80 text-white font-bold py-1.5 px-3 rounded-full transition-all backdrop-blur-sm"
              title="Recharger le lecteur vidéo"
            >
              🔄
            </button>
          </div>
        </div>
        <div className="lg:col-span-2">
          {analysis.transcription && (
            <div className="bg-black/30 p-6 rounded-xl shadow-2xl border border-cyan-400/20 backdrop-blur-lg h-full flex flex-col">
              <h2 className="text-xl font-bold text-cyan-300 mb-4">Transcription</h2>
              <div className="flex-grow max-h-[26rem] lg:max-h-full overflow-y-auto p-4 bg-gray-900/60 rounded-lg border border-gray-700 text-gray-300 whitespace-pre-wrap leading-relaxed scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {analysis.transcription.fullText}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section des Affirmations Extraites */}
      <div className="bg-black/30 p-8 rounded-xl shadow-2xl border border-fuchsia-500/20 backdrop-blur-lg flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-300">
            Affirmations Extraites
          </h2>
          <button
            onClick={onRerunClaims}
            disabled={areClaimsLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:scale-105 transition-transform duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:scale-100 shadow-lg hover:shadow-fuchsia-500/50"
            title="Relancer l'extraction des affirmations"
          >
            {areClaimsLoading ? <LoadingSpinner /> : "🌀 Relancer l'Extraction"}
          </button>
        </div>

        <div className="flex-grow">
          {areClaimsLoading ? (
            <div className="flex flex-col justify-center items-center h-full min-h-[200px] text-center text-cyan-200/80">
              <LoadingSpinner />
              <p className="mt-4 text-lg font-semibold">Ré-analyse des affirmations en cours...</p>
              <p className="text-sm">Cela peut prendre un moment.</p>
            </div>
          ) : (
            <ClaimList claims={analysis.claims} onClaimClick={onClaimClick} />
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalysisResult;