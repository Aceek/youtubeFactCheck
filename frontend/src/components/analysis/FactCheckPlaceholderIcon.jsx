// frontend/src/components/analysis/FactCheckPlaceholderIcon.jsx

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const FactCheckPlaceholderIcon = ({ reason }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const TooltipPortal = () => {
    if (!showTooltip) return null;
    return createPortal(
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{ left: tooltipPosition.x, top: tooltipPosition.y - 10, transform: 'translate(-50%, -100%)' }}
      >
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl w-72">
          <p className="font-bold text-sm text-gray-300">Fact-Checking Non Applicable</p>
          <p className="text-sm text-gray-400 mt-1">{reason}</p>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-600"></div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <div
        className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-gray-600 bg-black/20 cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="text-gray-500 font-bold">🎯</span>
      </div>
      <TooltipPortal />
    </>
  );
};

export default FactCheckPlaceholderIcon;
