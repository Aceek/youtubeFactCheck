import { VERDICTS, getTone } from '../../lib/factCheck';

// Barre de répartition des verdicts de fact-checking + légende.
function VerdictDistribution({ claims }) {
  const counts = {};
  let total = 0;
  for (const claim of claims || []) {
    if (claim.verdict) {
      counts[claim.verdict] = (counts[claim.verdict] || 0) + 1;
      total += 1;
    }
  }

  if (total === 0) return null;

  const order = Object.keys(VERDICTS).filter((k) => counts[k]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">Verdict breakdown</span>
        <span className="font-mono text-xs text-faint">{total} verified</span>
      </div>

      {/* Barre segmentée */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line-soft">
        {order.map((key) => {
          const tone = getTone(VERDICTS[key].tone);
          const width = (counts[key] / total) * 100;
          return <div key={key} className={tone.bar} style={{ width: `${width}%` }} title={`${VERDICTS[key].label}: ${counts[key]}`} />;
        })}
      </div>

      {/* Légende */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {order.map((key) => {
          const v = VERDICTS[key];
          const tone = getTone(v.tone);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
              <span className="font-mono text-sm font-semibold text-ink">{counts[key]}</span>
              <span className="truncate text-xs text-faint">{v.plural}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VerdictDistribution;
