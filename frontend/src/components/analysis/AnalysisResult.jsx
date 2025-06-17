import ClaimList from './ClaimList.jsx';

function AnalysisResult({ analysis }) {
  if (!analysis) return null;

  return (
    <div className="space-y-8">
      {/* Section Transcription */}
      {analysis.transcription && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-xl font-bold text-cyan-400 mb-4">Transcription Complète</h2>
          <div className="max-h-60 overflow-y-auto p-4 bg-gray-900 rounded-md border border-gray-700 text-gray-300 whitespace-pre-wrap leading-relaxed">
            {analysis.transcription.fullText}
          </div>
        </div>
      )}

      {/* Section Affirmations (Claims) */}
      <ClaimList claims={analysis.claims} />
    </div>
  );
}

export default AnalysisResult;