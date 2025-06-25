// frontend/src/components/analysis/ValidationIcon.jsx

import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const ValidationIcon = ({ claim }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const hideTimeoutRef = useRef(null);

  const validationConfig = {
    VALID: { 
      icon: '🔧', 
      color: 'text-green-500 border-green-500', 
      bgColor: 'bg-green-900/20',
      title: 'Validation IA : Valide'
    },
    INACCURATE: { 
      icon: '⚠️', 
      color: 'text-yellow-500 border-yellow-500', 
      bgColor: 'bg-yellow-900/20',
      title: 'Validation IA : Imprécis'
    },
    OUT_OF_CONTEXT: { 
      icon: '🔎', 
      color: 'text-orange-500 border-orange-500', 
      bgColor: 'bg-orange-900/20',
      title: 'Validation IA : Hors Contexte'
    },
    HALLUCINATION: { 
      icon: '👻', 
      color: 'text-red-500 border-red-500', 
      bgColor: 'bg-red-900/20',
      title: 'Validation IA : Hallucination'
    },
    NOT_VERIFIABLE_CLAIM: { 
      icon: '💬', 
      color: 'text-gray-400 border-gray-400', 
      bgColor: 'bg-gray-900/20',
      title: 'Validation IA : Non Vérifiable'
    },
    UNVERIFIED: { 
      icon: '…', 
      color: 'text-gray-500 border-gray-500', 
      bgColor: 'bg-gray-900/20',
      title: 'Validation IA : Non Vérifié'
    },
  };

  const config = validationConfig[claim.validationStatus] || validationConfig.UNVERIFIED;

  const handleMouseEnter = useCallback((e) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => setShowTooltip(false), 200);
  }, []);

  const handleTooltipInteraction = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }, []);

  const TooltipPortal = () => {
    if (!showTooltip) return null;
    return createPortal(
      <div
        className="fixed z-[9999] pointer-events-auto"
        style={{ left: tooltipPosition.x, top: tooltipPosition.y - 10, transform: 'translate(-50%, -100%)' }}
        onMouseEnter={handleTooltipInteraction}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`${config.bgColor} border ${config.color.replace('text-', 'border-')} rounded-lg p-4 shadow-xl backdrop-blur-sm w-80 max-w-sm`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{config.icon}</span>
            <span className={`font-bold text-sm ${config.color}`}>{config.title}</span>
          </div>
          {claim.validationExplanation && (
            <p className="text-sm text-gray-200 leading-relaxed italic">"{claim.validationExplanation}"</p>
          )}
          <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${config.color.replace('text-', 'border-t-')}`}></div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <div
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 ${config.color} ${config.bgColor} cursor-help transition-all duration-200 hover:scale-110`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={config.title}
      >
        <span className="text-sm font-bold">{config.icon}</span>
      </div>
      <TooltipPortal />
    </>
  );
};

export default ValidationIcon;
