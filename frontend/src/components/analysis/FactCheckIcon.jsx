import StatusBadge from '../common/StatusBadge';
import Icon from '../common/Icon';
import { getVerdict, getTone } from '../../lib/factCheck';

// Liste de sources cliquables (réutilisée en compact et étendu)
function SourceList({ sources, size = 'sm' }) {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return null;
  return (
    <div className={size === 'lg' ? 'mt-4' : 'mt-3'}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Sources</p>
      <div className={`space-y-1.5 ${size === 'sm' ? 'max-h-36 overflow-y-auto scrollbar-elegant pr-1' : ''}`}>
        {sources.map((source, index) => (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-start gap-1.5 text-xs text-brand-soft transition-colors hover:text-live"
          >
            <Icon name="externalLink" className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="break-all underline-offset-2 hover:underline">{source.title || source.url}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

const FactCheckIcon = ({ claim, extended = false }) => {
  if (!claim.verdict) return null;

  const v = getVerdict(claim.verdict);
  const tone = getTone(v.tone);

  // Mode étendu (vue détaillée)
  if (extended) {
    return (
      <div className={`rounded-xl border ${tone.border} ${tone.bg} p-5`}>
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${tone.border} ${tone.bg} ${tone.text}`}>
            <Icon name={v.glyph} className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Verdict</p>
            <p className={`text-lg font-bold ${tone.text}`}>{v.label}</p>
          </div>
        </div>
        {claim.verdictReason && <p className="mt-4 text-sm leading-relaxed text-muted">{claim.verdictReason}</p>}
        <SourceList sources={claim.sources} size="lg" />
      </div>
    );
  }

  // Mode compact (badge + tooltip)
  return (
    <StatusBadge tone={v.tone} glyph={v.glyph} title={`Verified · ${v.label}`} size="sm">
      {claim.verdictReason && <p>{claim.verdictReason}</p>}
      <SourceList sources={claim.sources} size="sm" />
    </StatusBadge>
  );
};

export default FactCheckIcon;
