import { useEffect, useRef } from 'react';
import Icon from '../common/Icon';
import {
  formatTimestamp,
  getValidation,
  getVerdict,
  getTone,
  computeConfidence,
  summarizeClaims,
} from '../../lib/factCheck';

// Détaille la "ligne" d'un événement du flux selon son type.
function describe(event) {
  switch (event.type) {
    case 'validated': {
      const v = getValidation(event.validationStatus);
      return { glyph: v.glyph, tone: v.tone, label: `Validated · ${v.label}` };
    }
    case 'verdict': {
      const v = getVerdict(event.verdict);
      return { glyph: v.glyph, tone: v.tone, label: `Verified · ${v.label}` };
    }
    case 'extracted':
    default:
      return { glyph: 'sparkle', tone: 'muted', label: 'Claim found' };
  }
}

function FeedRow({ event, onSeek }) {
  const { glyph, tone, label } = describe(event);
  const t = getTone(tone);

  return (
    <li
      onClick={() => onSeek?.(event.timestamp)}
      className="group flex cursor-pointer gap-3 rounded-xl border border-line bg-elevated/40 p-3 transition-colors duration-200 animate-rise hover:bg-elevated/70"
    >
      <span
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${t.border} ${t.bg} ${t.text}`}
      >
        <Icon name={glyph} className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold ${t.text}`}>{label}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-base/50 px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors group-hover:text-brand-soft">
            <Icon name="play" className="h-2.5 w-2.5" />
            {formatTimestamp(event.timestamp)}
          </span>
        </div>

        <p className="mt-1 truncate text-sm text-muted group-hover:text-ink">{event.text}</p>

        {/* Sources cliquables (verdicts uniquement) */}
        {event.type === 'verdict' && event.sources?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.sources.slice(0, 4).map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex max-w-[200px] items-center gap-1 rounded-md border border-line bg-base/50 px-1.5 py-0.5 text-[11px] text-brand-soft transition-colors hover:border-brand/40 hover:text-live"
              >
                <Icon name="externalLink" className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{source.title || source.url}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function ConfidencePill({ value }) {
  const pct = Math.round(value * 100);
  const level = pct >= 70 ? 'true' : pct >= 40 ? 'misleading' : 'false';
  const t = getTone(level);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${t.border} ${t.bg} px-2.5 py-1`}>
      <Icon name="gauge" className={`h-3.5 w-3.5 ${t.text}`} />
      <span className={`font-mono text-sm font-semibold ${t.text}`}>{pct}</span>
      <span className="text-[11px] text-faint">live confidence</span>
    </span>
  );
}

function Metric({ value, label, tone = 'text-ink' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`font-mono text-sm font-semibold ${tone}`}>{value}</span>
      <span className="text-xs text-faint">{label}</span>
    </span>
  );
}

// Flux d'activité en direct : montre le travail du pipeline au fil de l'eau
// (claims extraits, validés, vérifiés + sources), cliquable pour sauter au
// bon moment de la vidéo.
function LiveActivityFeed({ events, claims, onSeek }) {
  const scrollRef = useRef(null);
  const stuckRef = useRef(true); // collé en haut tant que l'utilisateur n'a pas descendu

  const { total, validated, verified } = summarizeClaims(claims);
  const confidence = computeConfidence(claims);

  // Le plus récent en premier : ce qui vient d'être vérifié (avec ses sources)
  // reste visible en haut, sans avoir à scroller.
  const orderedEvents = events.slice().reverse();

  // Auto-scroll vers le haut à l'arrivée d'événements, sauf si l'utilisateur a
  // descendu volontairement (pour consulter l'historique plus ancien).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stuckRef.current) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [events]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    stuckRef.current = el.scrollTop < 40;
  };

  return (
    <div className="panel flex h-full flex-col p-5">
      {/* En-tête vivant */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-60 animate-pulse-soft" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
          </span>
          <h2 className="text-lg font-bold text-ink">Live activity</h2>
        </div>
        {confidence !== null && <ConfidencePill value={confidence} />}
      </div>

      {/* Compteurs */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line bg-base/30 px-3.5 py-2.5">
        <Metric value={total} label={`claim${total > 1 ? 's' : ''} found`} />
        <span className="h-3 w-px bg-line" />
        <Metric value={validated} label="validated" tone="text-emerald-300" />
        <span className="h-3 w-px bg-line" />
        <Metric value={`${verified}/${total || 0}`} label="verified" tone="text-brand-soft" />
      </div>

      {/* Flux */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-custom max-h-[420px] flex-1 space-y-2.5 overflow-y-auto pr-1.5"
      >
        {events.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center text-muted">
            <Icon name="search" className="h-6 w-6 animate-pulse-soft text-faint" />
            <p className="text-sm">Waiting for the first results…</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {orderedEvents.map((event) => (
              <FeedRow key={event.key} event={event} onSeek={onSeek} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default LiveActivityFeed;
