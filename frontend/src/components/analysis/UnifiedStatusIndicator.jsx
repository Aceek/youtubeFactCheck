import ValidationIcon from './ValidationIcon';
import FactCheckIcon from './FactCheckIcon';
import FactCheckPlaceholderIcon from './FactCheckPlaceholderIcon';
import { isFactCheckSkipped, getSkipReason } from '../../lib/factCheck';

// Regroupe l'indicateur de validation IA et l'indicateur de fact-checking
// (verdict, ou placeholder si volontairement ignoré).
const UnifiedStatusIndicator = ({ claim }) => {
  const skipped = isFactCheckSkipped(claim);

  return (
    <>
      <ValidationIcon claim={claim} />
      {claim.verdict && <FactCheckIcon claim={claim} />}
      {skipped && <FactCheckPlaceholderIcon reason={getSkipReason(claim.validationStatus)} />}
    </>
  );
};

export default UnifiedStatusIndicator;
