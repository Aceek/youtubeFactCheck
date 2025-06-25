// frontend/src/components/analysis/UnifiedStatusIndicator.jsx

import React from 'react';
import ValidationIcon from './ValidationIcon';
import FactCheckIcon from './FactCheckIcon';

// Ce composant devient un simple conteneur qui affiche les deux indicateurs.
const UnifiedStatusIndicator = ({ claim }) => {
  return (
    <>
      {/* L'icône de validation est toujours présente (si l'étape a été exécutée) */}
      <ValidationIcon claim={claim} />

      {/* L'icône de fact-checking n'apparaît que si un verdict existe */}
      {claim.verdict && <FactCheckIcon claim={claim} />}
    </>
  );
};

export default UnifiedStatusIndicator;
