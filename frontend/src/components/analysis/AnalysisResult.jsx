import ClaimList from './ClaimList.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';

function AnalysisResult({ analysis, onPlayerReady, onClaimClick }) {
  if (!analysis) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Colonne de gauche : Lecteur vidéo et Transcription */}
      <div className="space-y-8">
        <YouTubePlayer videoId={analysis.videoId} onPlayerReady={onPlayerReady} />
        {analysis.transcription && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold text-cyan-400 mb-4">Transcription</h2>
            <div className="max-h-60 overflow-y-auto p-4 bg-gray-900 rounded-md border border-gray-700 text-gray-300 whitespace-pre-wrap leading-relaxed">
              {analysis.transcription.fullText}
            </div>
          </div>
        )}
      </div>

      {/* Colonne de droite : Affirmations (Claims) */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
         <h2 className="text-xl font-bold text-cyan-400 mb-4">Affirmations Extraites</h2>
        <ClaimList claims={analysis.claims} onClaimClick={onClaimClick} />
      </div>
    </div>
  );
}

export default AnalysisResult;