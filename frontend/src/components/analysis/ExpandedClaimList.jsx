import { useMemo, useRef, useEffect } from 'react';
import FactCheckIcon from './FactCheckIcon';
import ValidationIcon from './ValidationIcon';
import Icon from '../common/Icon';
import {
  formatTimestamp,
  getValidation,
  getVerdict,
  getTone,
  isFactCheckSkipped,
  getSkipReason,
  VALIDATIONS,
  VERDICTS,
} from '../../lib/factCheck';

const StatItem = ({ tone, label, count }) => {
  const t = getTone(tone);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
      <span className="font-mono font-semibold text-ink">{count}</span>
      <span className="truncate text-xs text-faint">{label}</span>
    </div>
  );
};

function ExpandedClaimList({ claims, onClaimClick, currentTime }) {
  const listContainerRef = useRef(null);
  const claimRefs = useRef({});
  claimRefs.current = {};

  const activeClaimId = useMemo(() => {
    let activeId = null;
    if (!claims) return null;
    for (const claim of claims) {
      if (claim.timestamp <= currentTime) activeId = claim.id;
      else break;
    }
    return activeId;
  }, [claims, currentTime]);

  useEffect(() => {
    const activeElement = claimRefs.current[activeClaimId];
    const container = listContainerRef.current;
    if (activeElement && container) {
      const desiredScrollTop =
        activeElement.offsetTop - container.offsetTop - container.clientHeight / 2 + activeElement.offsetHeight / 2;
      container.scrollTo({ top: desiredScrollTop, behavior: 'smooth' });
    }
  }, [activeClaimId]);

  const { validationStats, factCheckStats } = useMemo(() => {
    const vStats = {};
    const fcStats = {};
    if (!claims) return { validationStats: {}, factCheckStats: {} };
    for (const claim of claims) {
      vStats[claim.validationStatus] = (vStats[claim.validationStatus] || 0) + 1;
      if (claim.verdict) fcStats[claim.verdict] = (fcStats[claim.verdict] || 0) + 1;
    }
    return { validationStats: vStats, factCheckStats: fcStats };
  }, [claims]);

  if (!claims || claims.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
        <Icon name="search" className="h-10 w-10 text-faint" />
        <p className="text-lg text-muted">No factual claims extracted</p>
        <p className="text-sm text-faint">The content may have no clear dialogue, or the analysis is still running.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Synthèse des statistiques */}
      <div className="shrink-0 space-y-3 border-b border-line p-5">
        <div className="rounded-xl border border-line bg-base/30 p-3.5">
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-brand-soft">
            <Icon name="shield" className="h-4 w-4" /> AI validation summary
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
            {Object.entries(validationStats).map(([status, count]) => {
              const cfg = VALIDATIONS[status] || getValidation(status);
              return <StatItem key={status} tone={cfg.tone} label={cfg.plural} count={count} />;
            })}
          </div>
        </div>

        {Object.keys(factCheckStats).length > 0 && (
          <div className="rounded-xl border border-line bg-base/30 p-3.5">
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-live">
              <Icon name="gauge" className="h-4 w-4" /> Fact-checking summary
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(factCheckStats).map(([status, count]) => {
                const cfg = VERDICTS[status] || getVerdict(status);
                return <StatItem key={status} tone={cfg.tone} label={cfg.plural} count={count} />;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Liste détaillée */}
      <div ref={listContainerRef} className="scrollbar-modal flex-1 space-y-5 overflow-y-auto p-5">
        {claims.map((claim, index) => {
          const isActive = claim.id === activeClaimId;
          const tone = getTone(getValidation(claim.validationStatus).tone);
          const skipped = isFactCheckSkipped(claim);

          return (
            <div
              ref={(el) => (claimRefs.current[claim.id] = el)}
              key={claim.id}
              onClick={() => onClaimClick(claim.timestamp)}
              className={`cursor-pointer rounded-2xl border border-l-[3px] p-5 transition-all duration-200 ${
                isActive
                  ? 'border-brand/60 border-l-brand bg-brand/10'
                  : `border-line ${tone.border.replace('border-', 'border-l-')} bg-elevated/40 hover:bg-elevated/70`
              }`}
            >
              {/* En-tête : numéro + timestamp + action */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                      isActive ? 'bg-brand text-white' : 'border border-line bg-base/50 text-muted'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-base/50 px-2 py-1 font-mono text-xs text-muted">
                    <Icon name="clock" className="h-3 w-3" />
                    {formatTimestamp(claim.timestamp)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClaimClick(claim.timestamp);
                  }}
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                >
                  <Icon name="play" className="h-3.5 w-3.5" />
                  Jump to moment
                </button>
              </div>

              {/* Texte */}
              <p className={`mb-4 text-[15px] leading-relaxed ${isActive ? 'text-ink' : 'text-muted'}`}>
                « {claim.text} »
              </p>

              {/* Bloc fact-checking */}
              {claim.verdict ? (
                <FactCheckIcon claim={claim} extended />
              ) : skipped ? (
                <div className="rounded-xl border border-dashed border-line bg-base/30 p-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Icon name="help" className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Fact-checking not applicable</h3>
                  </div>
                  <p className="mt-1.5 pl-6 text-sm text-faint">{getSkipReason(claim.validationStatus)}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-base/30 p-4">
                  <div className="flex items-center gap-2 text-muted">
                    <Icon name="clock" className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Fact-checking pending</h3>
                  </div>
                  <p className="mt-1.5 pl-6 text-sm text-faint">
                    This claim will be verified if the option is enabled and it's deemed valid.
                  </p>
                </div>
              )}

              {/* Validation IA discrète */}
              <div className="mt-3 flex items-center gap-2 text-xs text-faint">
                <span>AI validation:</span>
                <ValidationIcon claim={claim} />
                <span className={getTone(getValidation(claim.validationStatus).tone).text}>
                  {getValidation(claim.validationStatus).label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ExpandedClaimList;
