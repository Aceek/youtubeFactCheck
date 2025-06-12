import { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

function AnalysisForm({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState('YOUTUBE');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url, provider);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <form onSubmit={handleSubmit}>
        <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-300 mb-2">
          URL de la vidéo YouTube
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

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-gray-300 mb-2">Méthode de transcription</legend>
          <div className="flex gap-4 p-2 bg-gray-900/50 rounded-md border border-gray-700">
            <div className="flex items-center">
              <input
                id="provider-youtube"
                name="provider"
                type="radio"
                value="YOUTUBE"
                checked={provider === 'YOUTUBE'}
                onChange={(e) => setProvider(e.target.value)}
                className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"
              />
              <label htmlFor="provider-youtube" className="ml-2 block text-sm text-gray-200">
                Simple (via YouTube)
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="provider-ai"
                name="provider"
                type="radio"
                value="AI"
                checked={provider === 'AI'}
                onChange={(e) => setProvider(e.target.value)}
                className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                disabled // On le désactive pour l'instant
              />
              <label htmlFor="provider-ai" className="ml-2 block text-sm text-gray-500">
                Avancée (IA) <span className="text-xs">(Bientôt)</span>
              </label>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

export default AnalysisForm;