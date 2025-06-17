import { useState } from 'react'; // Importer useState
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisResult from '../components/analysis/AnalysisResult';
import AnalysisStatus from '../components/analysis/AnalysisStatus';
import { useAnalysis } from '../hooks/useAnalysis';

function HomePage() {
  const { analysis, isLoading, error, startAnalysis } = useAnalysis();
  const [player, setPlayer] = useState(null); // État pour stocker l'objet lecteur

  const isProcessing = isLoading || (analysis && analysis.status !== 'COMPLETE' && analysis.status !== 'FAILED');

  // Fonction pour stocker le lecteur une fois qu'il est prêt
  const handlePlayerReady = (eventTarget) => {
    setPlayer(eventTarget);
  };

  // Fonction pour avancer la vidéo, passée aux enfants
  const handleClaimClick = (timestamp) => {
    if (player) {
      player.seekTo(timestamp); // L'API YouTube pour avancer la vidéo
      player.playVideo();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8"> {/* J'ai un peu élargi le conteneur */}
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
          onPlayerReady={handlePlayerReady}
          onClaimClick={handleClaimClick}
        />
      )}
    </div>
  );
}

export default HomePage;