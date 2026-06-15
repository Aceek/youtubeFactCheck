import { useMemo, useRef, useEffect } from 'react';
import UnifiedStatusIndicator from './UnifiedStatusIndicator';
import Icon from '../common/Icon';
import { formatTimestamp, getValidation, getTone } from '../../lib/factCheck';

function ClaimList({ claims, onClaimClick, currentTime }) {
  const listContainerRef = useRef(null);
  const claimRefs = useRef({});
  claimRefs.current = {};

  const activeClaimId = useMemo(() => {
    let activeId = null;
    for (const claim of claims) {
      if (claim.timestamp <= currentTime) {
        activeId = claim.id;
      } else {
        break;
      }
    }
    return activeId;
  }, [claims, currentTime]);

  useEffect(() => {
    const activeElement = claimRefs.current[activeClaimId];
    const container = listContainerRef.current;
    if (activeElement && container) {
      const containerTop = container.offsetTop;
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.offsetHeight;
      const containerHeight = container.clientHeight;
      const desiredScrollTop = elementTop - containerTop - containerHeight / 2 + elementHeight / 2;
      container.scrollTo({ top: desiredScrollTop, behavior: 'smooth' });
    }
  }, [activeClaimId]);

  if (!claims || claims.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-base/20 p-8 text-center">
        <Icon name="search" className="h-7 w-7 text-faint" />
        <p className="text-muted">No factual claims were extracted.</p>
        <p className="text-xs text-faint">
          This can happen if the content has no clear dialogue, or if the analysis is still running.
        </p>
      </div>
    );
  }

  return (
    <ul
      ref={listContainerRef}
      className="scrollbar-custom max-h-[360px] space-y-3 overflow-y-auto pr-1.5"
    >
      {claims.map((claim) => {
        const isActive = claim.id === activeClaimId;
        const tone = getTone(getValidation(claim.validationStatus).tone);

        return (
          <li
            ref={(el) => (claimRefs.current[claim.id] = el)}
            key={claim.id}
            onClick={() => onClaimClick(claim.timestamp)}
            className={`group cursor-pointer rounded-xl border border-l-[3px] p-4 transition-all duration-200 ${
              isActive
                ? 'border-brand/60 border-l-brand bg-brand/10 shadow-[0_0_0_1px_rgba(110,123,255,0.3)]'
                : `border-line ${tone.border.replace('border-', 'border-l-')} bg-elevated/40 hover:bg-elevated/70`
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`flex-1 text-[15px] leading-relaxed ${isActive ? 'text-ink' : 'text-muted group-hover:text-ink'}`}>
                {claim.text}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <UnifiedStatusIndicator claim={claim} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs transition-colors ${
                  isActive ? 'bg-brand text-white' : 'bg-base/50 text-muted group-hover:text-brand-soft'
                }`}
              >
                <Icon name="play" className="h-3 w-3" />
                {formatTimestamp(claim.timestamp)}
              </span>
              <span
                className={`text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 ${
                  isActive ? 'text-brand-soft' : 'text-faint'
                }`}
              >
                Jump to moment →
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default ClaimList;
