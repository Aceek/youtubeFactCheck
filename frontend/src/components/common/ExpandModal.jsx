import React from 'react';
import { useEscapeKey } from '../../hooks/useKeyboard';

function ExpandModal({ isOpen, onClose, children, title, type = 'default' }) {
  // Fermer le modal avec la touche Échap
  useEscapeKey(() => {
    if (isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getModalStyles = () => {
    switch (type) {
      case 'transcript':
        return {
          container: 'max-w-5xl max-h-[85vh]',
          content: 'max-h-[70vh]',
          gradient: 'from-cyan-400 to-blue-300'
        };
      case 'claims':
        return {
          container: 'max-w-4xl max-h-[90vh]',
          content: 'max-h-[75vh]',
          gradient: 'from-fuchsia-400 to-cyan-300'
        };
      default:
        return {
          container: 'max-w-3xl max-h-[90vh]',
          content: 'max-h-[75vh]',
          gradient: 'from-fuchsia-400 to-cyan-300'
        };
    }
  };

  const styles = getModalStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className={`relative bg-gray-900/95 rounded-xl shadow-2xl border-2 border-fuchsia-500/40 w-full ${styles.container} overflow-hidden flex flex-col animate-scale-in backdrop-blur-lg`}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-fuchsia-500/30 bg-black/30">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-gradient-to-b from-fuchsia-500 to-cyan-400 rounded-full"></div>
            <h2 className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${styles.gradient}`}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="group p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 hover:border-red-400 transition-all duration-200"
            aria-label="Fermer"
          >
            <svg 
              className="w-6 h-6 text-red-400 group-hover:text-red-300 transition-colors" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={`p-6 flex-grow overflow-y-auto scrollbar-modal ${styles.content}`}>
          {children}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-fuchsia-500/20 bg-black/20 text-center">
          <p className="text-sm text-gray-400">
            Appuyez sur <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Échap</kbd> pour fermer
          </p>
        </div>
      </div>
    </div>
  );
}

export default ExpandModal;