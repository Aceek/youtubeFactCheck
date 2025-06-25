import { useState } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

// ...
// On reçoit l'état et le setter en props
function AnalysisForm({ onSubmit, isLoading, runValidation, setRunValidation, runFactChecking, setRunFactChecking }) {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState('MOCK_PROVIDER');
  const [formError, setFormError] = useState('');

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
    onSubmit(url, provider, runValidation, runFactChecking);
  };
  
  return (
    <div className="bg-black/30 p-8 rounded-xl shadow-2xl border border-cyan-400/20 backdrop-blur-lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="youtube-url" className="block text-lg font-semibold text-cyan-300 mb-3">
            Lien de la vidéo YouTube à analyser
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="youtube-url"
              type="text"
              value={url}
              onChange={handleUrlChange}
              placeholder="Collez ici l'URL de la vidéo..."
              className={`flex-grow p-4 bg-gray-900/50 border-2 rounded-lg focus:ring-4 focus:outline-none transition-all duration-300 text-white placeholder-gray-500 ${
                formError
                  ? 'border-red-500/50 ring-red-500/20'
                  : 'border-cyan-400/30 focus:border-cyan-400 focus:ring-cyan-400/20'
              }`}
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="flex justify-center items-center bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white font-bold text-lg py-4 px-8 rounded-lg hover:scale-105 transition-transform duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:scale-100 shadow-lg hover:shadow-cyan-500/50"
            >
              {isLoading ? <LoadingSpinner /> : 'Analyser'}
            </button>
          </div>
          {formError && <p className="text-red-400 font-semibold text-md mt-3 animate-pulse">{formError}</p>}
        </div>

        <fieldset>
          <legend className="text-md font-medium text-cyan-200/80 mb-2">Mode d'analyse</legend>
          <div className="flex gap-4 p-3 bg-black/20 rounded-lg border border-cyan-400/20">
            <div className="flex items-center">
              <input
                id="provider-mock"
                name="provider"
                type="radio"
                value="MOCK_PROVIDER"
                checked={provider === 'MOCK_PROVIDER'}
                onChange={(e) => setProvider(e.target.value)}
                className="h-5 w-5 text-fuchsia-500 bg-gray-800 border-gray-600 focus:ring-fuchsia-500 focus:ring-2"
              />
              <label htmlFor="provider-mock" className="ml-3 block text-md text-gray-200">
                Démo (Rapide)
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
                className="h-5 w-5 text-fuchsia-500 bg-gray-800 border-gray-600 focus:ring-fuchsia-500 focus:ring-2"
              />
              <label htmlFor="provider-ai" className="ml-3 block text-md text-gray-200">
                Analyse Complète (IA)
              </label>
            </div>
          </div>
        </fieldset>

        {/* Options avancées */}
        <div className="space-y-4 pt-2">
          {/* Toggle de validation */}
          <div className="flex items-center justify-start">
            <label htmlFor="validation-toggle" className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  id="validation-toggle"
                  type="checkbox"
                  className="sr-only"
                  checked={runValidation}
                  onChange={() => {
                    const newValidation = !runValidation;
                    setRunValidation(newValidation);
                    // Si on désactive la validation, on désactive aussi le fact-checking
                    if (!newValidation && runFactChecking) {
                      setRunFactChecking(false);
                    }
                  }}
                />
                <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${runValidation ? 'translate-x-6 bg-cyan-400' : ''}`}></div>
              </div>
              <div className="ml-3 text-gray-200 font-medium">
                Activer la validation des affirmations <span className="text-xs text-gray-400">(plus lent)</span>
              </div>
            </label>
          </div>

          {/* Toggle de fact-checking */}
          <div className="flex items-center justify-start">
            <label htmlFor="factcheck-toggle" className={`flex items-center cursor-pointer ${!runValidation ? 'opacity-50' : ''}`}>
              <div className="relative">
                <input
                  id="factcheck-toggle"
                  type="checkbox"
                  className="sr-only"
                  checked={runFactChecking && runValidation}
                  disabled={!runValidation}
                  onChange={() => setRunFactChecking(!runFactChecking)}
                />
                <div className={`block w-14 h-8 rounded-full ${runValidation ? 'bg-gray-600' : 'bg-gray-700'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${runFactChecking && runValidation ? 'translate-x-6 bg-fuchsia-400' : ''}`}></div>
              </div>
              <div className="ml-3 text-gray-200 font-medium">
                Activer le fact-checking <span className="text-xs text-gray-400">(très lent, nécessite la validation)</span>
              </div>
            </label>
          </div>

          {runFactChecking && runValidation && (
            <div className="bg-fuchsia-900/20 border border-fuchsia-400/30 rounded-lg p-3 mt-2">
              <p className="text-fuchsia-200 text-sm">
                <span className="font-semibold">⚡ Fact-checking activé :</span> Les affirmations validées seront vérifiées via Google Fact Check et recherche web. Cette étape peut prendre plusieurs minutes.
              </p>
            </div>
          )}
        </div>
        {/* ... */}
      </form>
    </div>
  );
}

export default AnalysisForm;