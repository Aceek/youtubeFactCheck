import ClaimList from './ClaimList.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import VideoInfo from './VideoInfo.jsx'; // On déplace l'import ici

function AnalysisResult({ analysis, currentTime, playerKey, onPlayerReady, onClaimClick, onRerunClaims, onReloadPlayer }) {
  if (!analysis) return null;

  // Conditions d'affichage granulaires
  const videoDataAvailable = !!analysis.video?.title; // On vérifie une propriété clé comme le titre
  const transcriptionAvailable = !!analysis.transcription;
  const claimsAvailable = analysis.claims && analysis.claims.length > 0;
  
  // L'analyse est "en cours de traitement" si son statut n'est pas final
  const isProcessing = analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED';

  return (
    <div className="space-y-12">
      {/* Le bloc d'info s'affiche dès qu'il est prêt */}
      {videoDataAvailable && <VideoInfo video={analysis.video} />}

      {/* Le reste de la page s'affiche dès qu'on a un videoId */}
      {analysis.videoId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

          <div className="bg-black/30 p-6 rounded-xl shadow-2xl border border-fuchsia-500/20 backdrop-blur-lg flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-300">
                Affirmations Extraites
              </h2>
              <button
                onClick={onRerunClaims}
                disabled={isProcessing} // <-- Le bouton est désactivé PENDANT TOUT LE PROCESSUS
                className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:scale-105 transition-transform duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:scale-100 shadow-lg hover:shadow-fuchsia-500/50"
              >
                {isProcessing ? <LoadingSpinner /> : "🌀 Relancer l'Extraction"}
              </button>
            </div>
            
            <div className="flex-grow">
              {/* Cas 1: On attend les premiers claims */}
              {isProcessing && !claimsAvailable && (
                <div className="flex flex-col justify-center items-center h-full min-h-[200px] text-center text-cyan-200/80">
                  <LoadingSpinner />
                  <p className="mt-4 text-lg font-semibold">
                    {analysis.status === 'VALIDATING_CLAIMS'
                      ? 'Validation en cours...'
                      : 'Extraction en cours...'
                    }
                  </p>
                </div>
              )}
              
              {/* Cas 2: Les claims sont là (même si on les valide encore) */}
              {claimsAvailable && (
                  <ClaimList claims={analysis.claims} onClaimClick={onClaimClick} currentTime={currentTime} />
              )}

              {/* Cas 3: L'analyse est finie et il n'y a rien */}
              {!isProcessing && !claimsAvailable && (
                  <div className="text-center text-cyan-200/70 p-8">
                      <p className="text-lg">Aucune affirmation factuelle n'a été extraite.</p>
                  </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* La transcription s'affiche en dernier */}
      {transcriptionAvailable && (
        <div className="bg-black/30 p-6 rounded-xl shadow-2xl border border-cyan-400/20 backdrop-blur-lg">
          <h2 className="text-xl font-bold text-cyan-300 mb-4">Transcription Complète</h2>
          <div className="max-h-60 overflow-y-auto p-4 bg-gray-900/60 rounded-lg border border-gray-700 text-gray-300 whitespace-pre-wrap leading-relaxed scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {analysis.transcription.fullText}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisResult;