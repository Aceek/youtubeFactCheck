import { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

function AnalysisForm({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState('MOCK_PROVIDER');
  const [formError, setFormError] = useState(''); // État pour l'erreur de validation du formulaire

  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    // On efface l'erreur dès que l'utilisateur modifie l'URL
    if (formError) {
      setFormError('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validation côté frontend pour une meilleure UX
    if (!url.trim()) {
      setFormError('Veuillez saisir une URL.');
      return;
    }
    if (!YOUTUBE_URL_REGEX.test(url)) {
      setFormError('L\'URL ne semble pas être une URL YouTube valide.');
      return;
    }
    
    setFormError(''); // On efface toute erreur précédente
    onSubmit(url, provider);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="youtube-url" className="block text-sm font-bold text-gray-300 mb-2">
              URL de la vidéo YouTube à analyser
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="youtube-url"
                type="text"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://www.youtube.com/watch?v=..."
                // On ajoute une bordure rouge si le champ est en erreur
                className={`flex-grow p-3 bg-gray-900 border rounded-md focus:ring-2 focus:outline-none transition ${
                  formError ? 'border-red-500 ring-red-500' : 'border-gray-600 focus:ring-cyan-500'
                }`}
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="flex justify-center items-center bg-cyan-600 text-white font-bold py-3 px-6 rounded-md hover:bg-cyan-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isLoading ? <LoadingSpinner /> : 'Lancer'}
              </button>
            </div>
            {/* Affichage de l'erreur de validation directement sous le champ */}
            {formError && <p className="text-red-400 text-sm mt-2">{formError}</p>}
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-300 mb-2">Environnement de Test</legend>
            <div className="flex gap-4 p-2 bg-gray-900/50 rounded-md border border-gray-700">
              <div className="flex items-center">
                <input
                  id="provider-mock"
                  name="provider"
                  type="radio"
                  value="MOCK_PROVIDER"
                  checked={provider === 'MOCK_PROVIDER'}
                  onChange={(e) => setProvider(e.target.value)}
                  className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                />
                <label htmlFor="provider-mock" className="ml-2 block text-sm text-gray-200">
                  Test (Données simulées)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="provider-ai"
                  name="provider"
                  type="radio"
                  value="ASSEMBLY_AI"
                  checked={provider === 'ASSEMBLY_AI'}
                  onChange={(e) => setProvider(e.target.value)}
                  className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 focus:ring-cyan-500"
                />
                <label htmlFor="provider-ai" className="ml-2 block text-sm text-gray-200">
                  Réel (via AssemblyAI)
                </label>
              </div>
            </div>
          </fieldset>
        </div>
      </form>
    </div>
  );
}

export default AnalysisForm;