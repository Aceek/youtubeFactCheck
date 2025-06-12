function AnalysisResult({ analysis }) {
  if (!analysis || !analysis.transcription) {
    return null;
  }

  const { transcription } = analysis;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 animate-fade-in">
      <h2 className="text-xl font-bold text-cyan-400 mb-4">Résultats de la Transcription</h2>
      
      <div className="space-y-2">
        <p><span className="font-semibold text-gray-400">Fournisseur :</span> {transcription.provider}</p>
        <p><span className="font-semibold text-gray-400">Statut de l'analyse :</span> <span className="px-2 py-1 bg-green-900/50 text-green-300 text-xs font-medium rounded-full">{analysis.status}</span></p>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-gray-300 mb-2">Transcription Complète :</h3>
        <div className="max-h-96 overflow-y-auto p-4 bg-gray-900 rounded-md border border-gray-700 text-gray-300 whitespace-pre-wrap leading-relaxed">
          {transcription.fullText}
        </div>
      </div>
    </div>
  );
}

// Ajouter cette animation simple dans tailwind.config.js si vous le souhaitez
// keyframes: { 'fade-in': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } } },
// animation: { 'fade-in': 'fade-in 0.5s ease-out forwards' },

export default AnalysisResult;