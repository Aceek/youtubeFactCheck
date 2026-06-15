import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { getTone } from '../../lib/factCheck';

// Badge circulaire avec icône + tooltip flottant (portail).
// `children` = contenu détaillé du tooltip (sous le titre).
export default function StatusBadge({
  tone = 'muted',
  glyph = 'dots',
  title,
  size = 'md',
  dashed = false,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const hideTimer = useRef(null);
  const t = getTone(tone);

  const show = useCallback((e) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setOpen(true);
  }, []);

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);

  const keepOpen = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <>
      <span
        className={`inline-flex shrink-0 items-center justify-center ${dim} rounded-full border ${
          dashed ? 'border-dashed border-line text-faint bg-base/40' : `${t.border} ${t.bg} ${t.text}`
        } cursor-help transition-transform duration-200 hover:scale-110`}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        <Icon name={glyph} className={iconSize} />
      </span>

      {open &&
        createPortal(
          <div
            className="fixed z-[9999] w-80 max-w-[88vw] -translate-x-1/2 -translate-y-full pointer-events-auto"
            style={{ left: pos.x, top: pos.y - 12 }}
            onMouseEnter={keepOpen}
            onMouseLeave={scheduleHide}
          >
            <div className="panel-raised p-4 animate-scale-in">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${
                    dashed ? 'border-line text-faint' : `${t.border} ${t.bg} ${t.text}`
                  }`}
                >
                  <Icon name={glyph} className="w-4 h-4" />
                </span>
                <span className={`text-sm font-semibold ${dashed ? 'text-muted' : t.text}`}>{title}</span>
              </div>
              {children && <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>}
            </div>
            <div className="mx-auto h-3 w-3 -translate-y-1.5 rotate-45 border-b border-r border-line bg-elevated" />
          </div>,
          document.body
        )}
    </>
  );
}
