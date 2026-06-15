import StatusBadge from '../common/StatusBadge';

const FactCheckPlaceholderIcon = ({ reason }) => (
  <StatusBadge tone="muted" glyph="help" title="Fact-checking not applicable" size="sm" dashed>
    {reason}
  </StatusBadge>
);

export default FactCheckPlaceholderIcon;
