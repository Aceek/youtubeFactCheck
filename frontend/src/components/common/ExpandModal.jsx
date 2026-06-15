import { useEscapeKey } from '../../hooks/useKeyboard';
import Icon from './Icon';

function ExpandModal({ isOpen, onClose, children, title, type = 'default' }) {
  useEscapeKey(() => {
    if (isOpen) onClose();
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    transcript: 'max-w-5xl h-[85vh]',
    claims: 'max-w-4xl h-[90vh]',
    default: 'max-w-3xl h-[90vh]',
  };
  const containerSize = sizes[type] || sizes.default;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`panel-raised flex w-full flex-col overflow-hidden animate-scale-in ${containerSize}`}>
        {/* En-tête */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-gradient-to-b from-brand to-live" />
            <h2 className="text-lg font-bold text-ink">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-300"
            aria-label="Fermer"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-hidden">{children}</div>

        {/* Pied */}
        <div className="shrink-0 border-t border-line px-6 py-3 text-center">
          <p className="text-xs text-faint">
            Press <kbd className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

export default ExpandModal;
