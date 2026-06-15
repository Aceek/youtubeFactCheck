import StatusBadge from '../common/StatusBadge';
import { getValidation } from '../../lib/factCheck';

const ValidationIcon = ({ claim }) => {
  const v = getValidation(claim.validationStatus);

  return (
    <StatusBadge tone={v.tone} glyph={v.glyph} title={`AI validation · ${v.label}`} size="sm">
      {claim.validationExplanation ? (
        <span className="italic">“{claim.validationExplanation}”</span>
      ) : (
        <span>Fidelity of the claim to its source.</span>
      )}
    </StatusBadge>
  );
};

export default ValidationIcon;
