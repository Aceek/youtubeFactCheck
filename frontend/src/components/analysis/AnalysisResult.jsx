import ClaimList from './ClaimList.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';

function AnalysisResult({ analysis, playerKey, onPlayerReady, onClaimClick, onRerunClaims, onReloadPlayer }) {
  if (!analysis) return null;

  // On détermine l'état de chargement des claims en se basant sur le statut de l'analyse
  const areClaimsLoading = analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Colonne de gauche : reste affichée en permanence */}
      <div className="space-y-8">
        <div className="relative">
          <YouTubePlayer
            key={playerKey}
            videoId={analysis.videoId}
            onPlayerReady={onPlayerReady}
          />
          <button
            onClick={onReloadPlayer}
            className="absolute top-2 right-2 text-xs bg-black bg-opacity-50 hover:bg-opacity-75 text-white font-bold py-1 px-2 rounded-full"
            title="Recharger le lecteur vidéo"
          >
            Reload
          </button>
        </div>
        {analysis.transcription && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold text-cyan-400 mb-4">Transcription</h2>
            <div className="max-h-60 overflow-y-auto p-4 bg-gray-900 rounded-md border border-gray-700 text-gray-300 whitespace-pre-wrap leading-relaxed">
              {analysis.transcription.fullText}
            </div>
          </div>
        )}
      </div>

      {/* Colonne de droite : Gère son propre état de chargement */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 flex flex-col">
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-cyan-400">Affirmations Extraites</h2>
            <button
              onClick={onRerunClaims}
              disabled={areClaimsLoading}
              className="text-xs bg-gray-700 hover:bg-cyan-700 text-white font-bold py-1 px-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Relancer l'extraction des affirmations"
            >
              {areClaimsLoading && <LoadingSpinner />}
              Relancer
            </button>
         </div>

         <div className="flex-grow">
           {/* On affiche le spinner ICI si les claims chargent */}
           {areClaimsLoading ? (
             <div className="flex justify-center items-center h-full">
                 <div className="text-center text-gray-400">
                     <LoadingSpinner />
                     <p className="mt-2 text-sm">Ré-analyse des affirmations en cours...</p>
                 </div>
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