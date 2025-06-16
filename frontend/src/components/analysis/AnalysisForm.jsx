import { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

function AnalysisForm({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('');
  // Le fournisseur est maintenant fixé, plus besoin de le sélectionner.
  const provider = 'ASSEMBLY_AI';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url, provider);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <form onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="youtube-url" className="block text-sm font-bold text-gray-300">
            URL de la vidéo YouTube à analyser
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="youtube-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-grow p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="flex justify-center items-center bg-cyan-600 text-white font-bold p-3 rounded-md hover:bg-cyan-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? <LoadingSpinner /> : 'Lancer l\'Analyse'}
            </button>
          </div>
          <p className="text-xs text-gray-400 pl-1">
            La transcription est gérée par notre service d'analyse audio professionnel.
          </p>
        </div>
      </form>
    </div>
  );
}

export default AnalysisForm;