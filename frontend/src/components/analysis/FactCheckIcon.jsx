import React, { useState } from 'react';
import { createPortal } from 'react-dom';

// Composant pour afficher les verdicts de fact-checking avec tooltip
const FactCheckIcon = ({ claim, extended = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Si pas de verdict de fact-checking, ne rien afficher
  if (!claim.verdict) {
    return null;
  }

  // Configuration des icônes et couleurs selon le verdict
  const verdictConfig = {
    TRUE: { 
      icon: '✅', 
      color: 'text-green-400 border-green-400', 
      bgColor: 'bg-green-900/20',
      title: 'VÉRIFIÉ - VRAI' 
    },
    FALSE: { 
      icon: '❌', 
      color: 'text-red-400 border-red-400', 
      bgColor: 'bg-red-900/20',
      title: 'VÉRIFIÉ - FAUX' 
    },
    MISLEADING: { 
      icon: '⚠️', 
      color: 'text-orange-400 border-orange-400', 
      bgColor: 'bg-orange-900/20',
      title: 'VÉRIFIÉ - TROMPEUR' 
    },
    UNVERIFIABLE: { 
      icon: '❓', 
      color: 'text-gray-400 border-gray-400', 
      bgColor: 'bg-gray-900/20',
      title: 'NON VÉRIFIABLE' 
    }
  };

  const config = verdictConfig[claim.verdict] || verdictConfig.UNVERIFIABLE;

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
        <div className={`${config.bgColor} border ${config.color.replace('text-', 'border-')} rounded-lg p-4 shadow-xl backdrop-blur-sm w-80 max-w-sm`}>
          {/* En-tête du verdict */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{config.icon}</span>
            <span className={`font-bold text-sm ${config.color}`}>
              {config.title}
            </span>
          </div>

          {/* Explication du verdict */}
          {claim.verdictReason && (
            <div className="mb-3">
              <p className="text-sm text-gray-200 leading-relaxed">
                {claim.verdictReason}
              </p>
            </div>
          )}

          {/* Sources */}
          {claim.sources && Array.isArray(claim.sources) && claim.sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-300 mb-2">
                Sources consultées :
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {claim.sources.map((source, index) => (
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
          <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${config.color.replace('text-', 'border-t-')}`}></div>
        </div>
      </div>,
      document.body
    );
  };

  // Mode étendu pour la vue détaillée
  if (extended) {
    return (
      <div className="w-full">
        {/* Affichage étendu avec toutes les informations visibles */}
        <div className={`${config.bgColor} border ${config.color.replace('text-', 'border-')} rounded-lg p-4`}>
          {/* En-tête du verdict */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{config.icon}</span>
            <span className={`font-bold text-lg ${config.color}`}>
              {config.title}
            </span>
          </div>

          {/* Explication du verdict */}
          {claim.verdictReason && (
            <div className="mb-4">
              <p className="text-sm text-gray-200 leading-relaxed">
                {claim.verdictReason}
              </p>
            </div>
          )}

          {/* Sources */}
          {claim.sources && Array.isArray(claim.sources) && claim.sources.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-3">
                Sources consultées :
              </p>
              <div className="space-y-2">
                {claim.sources.map((source, index) => (
                  <div key={index} className="text-sm">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:text-cyan-200 underline break-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {source.title || source.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mode compact avec tooltip flottant (usage par défaut)
  return (
    <>
      {/* Icône principale */}
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

export default FactCheckIcon;