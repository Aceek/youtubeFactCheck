import React from 'react';

// Composants SVG pour les icônes
const CheckIcon = () => (
  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin w-5 h-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const DotIcon = () => (
  <div className="w-5 h-5 flex items-center justify-center">
      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
  </div>
);


function AnalysisStatus({ analysis, withValidation }) {
  // Sécurité : si analysis est null ou ne contient pas de status, on n'affiche rien
  if (!analysis || !analysis.status) return null;

  // Définir les étapes de notre processus. C'est facilement extensible pour le futur.
  const baseSteps = [
    { status: 'PENDING', label: 'Initialisation de l\'analyse' },
    { status: 'FETCHING_METADATA', label: 'Récupération des informations de la vidéo' },
    { status: 'TRANSCRIBING', label: 'Téléchargement et Transcription de l\'audio' },
    { status: 'EXTRACTING_CLAIMS', label: 'Extraction des affirmations factuelles' },
  ];

  if (withValidation) {
    baseSteps.push({ status: 'VALIDATING_CLAIMS', label: 'Validation des affirmations' });
  }

  baseSteps.push({ status: 'COMPLETE', label: 'Analyse terminée' });

  const steps = baseSteps;

  // Trouver l'index de l'étape actuelle
  const currentStepIndex = steps.findIndex(step => step.status === analysis.status);

  return (
    <div className="bg-black/30 p-8 rounded-xl shadow-2xl border border-cyan-400/20 backdrop-blur-lg animate-fade-in">
      <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400 mb-6">
        Analyse en cours...
      </h2>
      <div className="relative space-y-6">
        {/* Ligne de progression en arrière-plan */}
        <div className="absolute left-4 top-0 h-full w-0.5 bg-cyan-400/20" />
        
        {steps.map((step, index) => {
          let visualState = 'pending';
          if (index < currentStepIndex) {
            visualState = 'completed';
          } else if (index === currentStepIndex) {
            visualState = 'in-progress';
          }

          return (
            <div key={step.status} className="flex items-center gap-5 relative pl-2">
              <div className="flex-shrink-0 z-10">
                {visualState === 'completed' && <CheckIcon />}
                {visualState === 'in-progress' && <SpinnerIcon />}
                {visualState === 'pending' && <DotIcon />}
              </div>
              <p className={`text-lg transition-all duration-300 ${
                visualState === 'completed' ? 'text-green-400 font-semibold' : ''
              } ${
                visualState === 'in-progress' ? 'text-cyan-300 font-bold scale-105' : ''
              } ${
                visualState === 'pending' ? 'text-gray-500' : ''
              }`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
      {analysis.status === 'FAILED' && (
        <p className="mt-6 text-center text-red-400 font-bold text-lg animate-pulse">
          L'analyse a échoué. Veuillez vérifier l'URL et réessayer.
        </p>
      )}
    </div>
  );
}

export default AnalysisStatus;