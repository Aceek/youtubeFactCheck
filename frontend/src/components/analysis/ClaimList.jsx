import React, { useMemo, useRef, useEffect } from 'react';
import UnifiedStatusIndicator from './UnifiedStatusIndicator';

function ClaimList({ claims, onClaimClick, currentTime }) {
  // --- NOUVEAU : Référence pour le conteneur scrollable (la liste <ul>) ---
  const listContainerRef = useRef(null);

  // Références pour chaque élément <li> individuel
  const claimRefs = useRef({});
  claimRefs.current = {}; // On réinitialise à chaque render pour éviter les références obsolètes

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

  // --- LOGIQUE DE SCROLL CORRIGÉE ---
  useEffect(() => {
    const activeElement = claimRefs.current[activeClaimId];
    const container = listContainerRef.current;

    if (activeElement && container) {
      // Calcul des positions
      const containerTop = container.offsetTop;
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.offsetHeight;
      const containerHeight = container.clientHeight;

      // Position de défilement désirée pour centrer l'élément
      const desiredScrollTop =
        elementTop - containerTop - containerHeight / 2 + elementHeight / 2;

      // On applique le scroll avec un effet "smooth"
      container.scrollTo({
        top: desiredScrollTop,
        behavior: "smooth",
      });
    }
  }, [activeClaimId]);

  const getBorderColor = (status) => {
    switch (status) {
      case 'VALID': return 'border-green-500/80';
      case 'INACCURATE': return 'border-yellow-500/80';
      case 'OUT_OF_CONTEXT': return 'border-orange-500/80';
      case 'HALLUCINATION': return 'border-red-500/80';
      case 'NOT_VERIFIABLE_CLAIM': return 'border-gray-400/80'; // <-- NOUVELLE COULEUR
      default: return 'border-fuchsia-500';
    }
  };
  
  if (!claims || claims.length === 0) {
    return (
      <div className="text-center text-cyan-200/70 p-8 border-2 border-dashed border-cyan-400/20 rounded-xl bg-black/20">
        <p className="text-lg">
          Aucune affirmation factuelle n'a été extraite.
        </p>
        <p className="text-sm">
          Cela peut se produire si la vidéo ne contient pas de dialogue clair ou
          si l'analyse est encore en cours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* On applique la référence au conteneur <ul> ici */}
      <ul
        ref={listContainerRef}
        className="space-y-4 max-h-[calc(390px-3rem)] overflow-y-auto p-1 pr-2 scrollbar-custom"
      >
        {claims.map((claim) => {
          const isActive = claim.id === activeClaimId;
          const borderColor = getBorderColor(claim.validationStatus);
          
          return (
            <li
              // On assigne dynamiquement les références à chaque élément
              ref={(el) => (claimRefs.current[claim.id] = el)}
              key={claim.id}
              onClick={() => onClaimClick(claim.timestamp)}
              className={`
                p-5 border-l-4 rounded-r-lg shadow-lg
                transition-all duration-300 cursor-pointer group
                ${isActive
                  ? 'bg-cyan-900/50 !border-cyan-400 scale-105 shadow-cyan-500/20' // !border-cyan-400 pour forcer la couleur si actif
                  : `bg-gray-900/50 ${borderColor} hover:bg-gray-800/70`
                }
              `}
            >
              <div className="flex justify-between items-start gap-4">
                <p className={`text-lg transition-colors flex-1 ${isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                  "{claim.text}"
                </p>
                <div className="flex items-center gap-2">
                  <UnifiedStatusIndicator claim={claim} />
                </div>
              </div>
              <div className="text-right mt-3">
                <span
                  className={`text-sm font-mono px-2 py-1 rounded transition-colors ${
                    isActive
                      ? "bg-cyan-400 text-black"
                      : "text-fuchsia-400 bg-black/30"
                  }`}
                >
                  à{" "}
                  {new Date(claim.timestamp * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ClaimList;
