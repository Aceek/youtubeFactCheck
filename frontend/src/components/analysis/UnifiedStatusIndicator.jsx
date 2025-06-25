import React, { useState } from 'react';
import { createPortal } from 'react-dom';

// Composant unifié pour afficher le statut avec priorité fact-checking > validation
const UnifiedStatusIndicator = ({ claim }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Logique de priorité : fact-checking en premier, validation en fallback
  const getUnifiedStatus = () => {
    if (claim.verdict) {
      return {
        type: 'fact-check',
        status: claim.verdict,
        explanation: claim.verdictReason,
        sources: claim.sources,
        config: getFactCheckConfig(claim.verdict)
      };
    } else {
      return {
        type: 'validation',
        status: claim.validationStatus,
        explanation: claim.validationExplanation,
        sources: null,
        config: getValidationConfig(claim.validationStatus)
      };
    }
  };

  // Configuration pour les verdicts de fact-checking
  const getFactCheckConfig = (verdict) => {
    const configs = {
      TRUE: { 
        icon: '✅', 
        color: 'text-green-400 border-green-400', 
        bgColor: 'bg-green-900/20',
        title: 'VÉRIFIÉ - VRAI',
        priority: 'high'
      },
      FALSE: { 
        icon: '❌', 
        color: 'text-red-400 border-red-400', 
        bgColor: 'bg-red-900/20',
        title: 'VÉRIFIÉ - FAUX',
        priority: 'high'
      },
      MISLEADING: { 
        icon: '⚠️', 
        color: 'text-orange-400 border-orange-400', 
        bgColor: 'bg-orange-900/20',
        title: 'VÉRIFIÉ - TROMPEUR',
        priority: 'high'
      },
      UNVERIFIABLE: { 
        icon: '❓', 
        color: 'text-gray-400 border-gray-400', 
        bgColor: 'bg-gray-900/20',
        title: 'NON VÉRIFIABLE',
        priority: 'medium'
      }
    };
    return configs[verdict] || configs.UNVERIFIABLE;
  };

  // Configuration pour les statuts de validation
  const getValidationConfig = (status) => {
    const configs = {
      VALID: { 
        icon: '✅', 
        color: 'text-green-500 border-green-500', 
        bgColor: 'bg-green-500/10',
        title: 'Valide & Vérifiable',
        priority: 'low'
      },
      INACCURATE: { 
        icon: '⚠️', 
        color: 'text-yellow-500 border-yellow-500', 
        bgColor: 'bg-yellow-500/10',
        title: 'Imprécis',
        priority: 'low'
      },
      OUT_OF_CONTEXT: { 
        icon: '🔎', 
        color: 'text-orange-500 border-orange-500', 
        bgColor: 'bg-orange-500/10',
        title: 'Hors contexte',
        priority: 'low'
      },
      HALLUCINATION: { 
        icon: '👻', 
        color: 'text-red-500 border-red-500', 
        bgColor: 'bg-red-500/10',
        title: 'Hallucination',
        priority: 'low'
      },
      NOT_VERIFIABLE_CLAIM: { 
        icon: '💬', 
        color: 'text-gray-400 border-gray-400', 
        bgColor: 'bg-gray-400/10',
        title: 'Non Vérifiable',
        priority: 'low'
      },
      UNVERIFIED: { 
        icon: '…', 
        color: 'text-gray-500 border-gray-500', 
        bgColor: 'bg-gray-500/10',
        title: 'Non vérifié',
        priority: 'low'
      }
    };
    return configs[status] || configs.UNVERIFIED;
  };

  const unifiedStatus = getUnifiedStatus();
  const { config, type, explanation, sources } = unifiedStatus;

  // Gestion de la position du tooltip
  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  // Composant Tooltip flottant avec portail
  const TooltipPortal = () => {
    if (!showTooltip) return null;

    return createPortal(
      <div 
        className="fixed z-[9999] pointer-events-none"
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y - 10,
          transform: 'translate(-50%, -100%)'
        }}
      >
        <div className={`${config.bgColor} border ${config.color.replace('text-', 'border-')} rounded-lg p-4 shadow-xl backdrop-blur-sm max-w-sm w-80`}>
          {/* En-tête du statut */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{config.icon}</span>
            <span className={`font-bold text-sm ${config.color}`}>
              {config.title}
            </span>
            {type === 'validation' && (
              <span className="text-xs bg-gray-600/50 px-2 py-1 rounded text-gray-300">
                Validation IA
              </span>
            )}
          </div>

          {/* Explication */}
          {explanation && (
            <div className="mb-3">
              <p className="text-sm text-gray-200 leading-relaxed">
                {explanation}
              </p>
            </div>
          )}

          {/* Sources (uniquement pour fact-checking) */}
          {type === 'fact-check' && sources && Array.isArray(sources) && sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-300 mb-2">
                Sources consultées :
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {sources.map((source, index) => (
                  <div key={index} className="text-xs">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:text-cyan-200 underline break-all pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {source.title || source.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flèche du tooltip */}
          <div 
            className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${config.color.replace('text-', 'border-t-')}`}
          ></div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      {/* Indicateur principal */}
      <div
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 ${config.color} ${config.bgColor} cursor-help transition-all duration-200 hover:scale-110`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={config.title}
      >
        <span className="text-sm font-bold">{config.icon}</span>
      </div>

      {/* Tooltip flottant via portail */}
      <TooltipPortal />
    </>
  );
};

export default UnifiedStatusIndicator;