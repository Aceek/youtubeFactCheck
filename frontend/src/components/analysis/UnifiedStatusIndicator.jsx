// frontend/src/components/analysis/UnifiedStatusIndicator.jsx

import React from 'react';
import ValidationIcon from './ValidationIcon';
import FactCheckIcon from './FactCheckIcon';
import FactCheckPlaceholderIcon from './FactCheckPlaceholderIcon'; // <-- Importer le placeholder

const UnifiedStatusIndicator = ({ claim }) => {
  // Détermine si le fact-checking a été intentionnellement ignoré.
  const isFactCheckSkipped = !claim.verdict && 
    ['HALLUCINATION', 'INACCURATE', 'NOT_VERIFIABLE_CLAIM'].includes(claim.validationStatus);

  const getSkipReason = () => {
    switch (claim.validationStatus) {
      case 'HALLUCINATION':
        return "L'affirmation a été jugée comme une hallucination par l'IA et n'a donc pas été vérifiée.";
      case 'INACCURATE':
        return "L'affirmation a été jugée imprécise et n'a donc pas été vérifiée.";
      case 'NOT_VERIFIABLE_CLAIM':
        return "L'affirmation a été jugée comme non-vérifiable (opinion, question) et n'a donc pas été fact-checkée.";
      default:
        return "Le fact-checking n'a pas été appliqué pour cette affirmation.";
    }
  };

  return (
    <>
      <ValidationIcon claim={claim} />

      {/* Cas 1: Le fact-checking a un verdict, on l'affiche. */}
      {claim.verdict && <FactCheckIcon claim={claim} />}

      {/* Cas 2: Le fact-checking a été ignoré, on affiche le placeholder. */}
      {isFactCheckSkipped && <FactCheckPlaceholderIcon reason={getSkipReason()} />}
    </>
  );
};

export default UnifiedStatusIndicator;
