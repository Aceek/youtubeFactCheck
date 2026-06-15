import { useEffect, useRef, useState } from 'react';
import { toPercent } from '../../lib/factCheck';

// Jauge radiale animée pour le score de confiance global.
function ConfidenceGauge({ score, size = 132 }) {
  const target = toPercent(score);
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === null) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplay(target);
      return;
    }

    const duration = 1100;
    let start = null;
    const animate = (ts) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [target]);

  if (target === null) return null;

  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - display / 100);

  // Couleur selon le niveau de confiance
  const level = target >= 70 ? 'high' : target >= 40 ? 'mid' : 'low';
  const colors = {
    high: { stop1: '#34d399', stop2: '#2dd4bf', text: 'text-emerald-300', label: 'High confidence' },
    mid: { stop1: '#fbbf24', stop2: '#fb923c', text: 'text-amber-300', label: 'Moderate confidence' },
    low: { stop1: '#fb7185', stop2: '#f43f5e', text: 'text-rose-300', label: 'Low confidence' },
  }[level];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colors.stop1} />
              <stop offset="100%" stopColor={colors.stop2} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#gauge-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-bold leading-none text-ink">{display}</span>
          <span className="mt-0.5 text-xs font-medium text-faint">/ 100</span>
        </div>
      </div>
      <span className={`mt-3 text-sm font-semibold ${colors.text}`}>{colors.label}</span>
    </div>
  );
}

export default ConfidenceGauge;
