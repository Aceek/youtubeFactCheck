// frontend/src/components/analysis/ExpandedClaimList.jsx

import React, { useMemo, useRef, useEffect } from 'react';
import FactCheckIcon from './FactCheckIcon';
import ValidationIcon from './ValidationIcon';

// --- NOUVEAU : Composant interne pour des statistiques compactes ---
const StatItem = ({ icon, label, count, colorClass }) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-lg">{icon}</span>
    <span className={`font-bold ${colorClass}`}>{count}</span>
    <span className="text-gray-300">{label}</span>
  </div>
);

function ExpandedClaimList({ claims, onClaimClick, currentTime }) {
  const listContainerRef = useRef(null);
  const claimRefs = useRef({});
  claimRefs.current = {};

  const activeClaimId = useMemo(() => {
    let activeId = null;
    if (!claims) return null;
    for (const claim of claims) {
      if (claim.timestamp <= currentTime) {
        activeId = claim.id;
      } else {
        break;
      }
    }
    return activeId;
  }, [claims, currentTime]);

  useEffect(() => {
    const activeElement = claimRefs.current[activeClaimId];
    const container = listContainerRef.current;

    if (activeElement && container) {
      const containerTop = container.offsetTop;
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.offsetHeight;
      const containerHeight = container.clientHeight;

      const desiredScrollTop =
        elementTop - containerTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: desiredScrollTop,
        behavior: "smooth",
      });
    }
  }, [activeClaimId]);

  // --- NOUVEAU : Calcul des deux types de statistiques ---
  const { validationStats, factCheckStats } = useMemo(() => {
    const vStats = {};
    const fcStats = {};
    if (!claims) return { validationStats: {}, factCheckStats: {} };

    for (const claim of claims) {
      vStats[claim.validationStatus] = (vStats[claim.validationStatus] || 0) + 1;
      if (claim.verdict) {
        fcStats[claim.verdict] = (fcStats[claim.verdict] || 0) + 1;
      }
    }
    return { validationStats: vStats, factCheckStats: fcStats };
  }, [claims]);

  // --- NOUVEAU : Configurations pour l'affichage des statistiques ---
  const validationStatConfig = {
    VALID: { icon: '✅', label: 'Valides', colorClass: 'text-green-400' },
    INACCURATE: { icon: '⚠️', label: 'Imprécis', colorClass: 'text-yellow-400' },
    OUT_OF_CONTEXT: { icon: '🔎', label: 'Hors Contexte', colorClass: 'text-orange-400' },
    HALLUCINATION: { icon: '👻', label: 'Hallucinations', colorClass: 'text-red-400' },
    NOT_VERIFIABLE_CLAIM: { icon: '💬', label: 'Non Vérifiables', colorClass: 'text-gray-400' },
    UNVERIFIED: { icon: '…', label: 'Non Vérifiés', colorClass: 'text-gray-500' },
  };

  const factCheckStatConfig = {
    TRUE: { icon: '✅', label: 'Vrais', colorClass: 'text-green-400' },
    FALSE: { icon: '❌', label: 'Faux', colorClass: 'text-red-400' },
    MISLEADING: { icon: '⚠️', label: 'Trompeurs', colorClass: 'text-orange-400' },
    UNVERIFIABLE: { icon: '❓', label: 'Invérifiables', colorClass: 'text-gray-400' },
  };

  const getBorderColor = (status) => {
    switch (status) {
      case 'VALID': return 'border-green-500/80';
      case 'INACCURATE': return 'border-yellow-500/80';
      case 'OUT_OF_CONTEXT': return 'border-orange-500/80';
      case 'HALLUCINATION': return 'border-red-500/80';
      case 'NOT_VERIFIABLE_CLAIM': return 'border-gray-400/80';
      default: return 'border-fuchsia-500';
    }
  };

  const getBackgroundColor = (status, isActive) => {
    if (isActive) return 'bg-cyan-900/60';
    
    switch (status) {
      case 'VALID': return 'bg-green-900/20';
      case 'INACCURATE': return 'bg-yellow-900/20';
      case 'OUT_OF_CONTEXT': return 'bg-orange-900/20';
      case 'HALLUCINATION': return 'bg-red-900/20';
      case 'NOT_VERIFIABLE_CLAIM': return 'bg-gray-900/20';
      default: return 'bg-gray-900/30';
    }
  };

  if (!claims || claims.length === 0) {
    return (
      <div className="text-center text-cyan-200/70 p-12 border-2 border-dashed border-cyan-400/20 rounded-xl bg-black/20">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-xl mb-2">Aucune affirmation factuelle extraite</p>
        <p className="text-sm text-gray-400">
          La vidéo ne contient peut-être pas de dialogue clair ou l'analyse est encore en cours.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* --- NOUVELLE SECTION DE STATISTIQUES REFAITE --- */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700/50 space-y-4">
        {/* Ligne 1: Statistiques de Validation */}
        <div className="bg-black/20 p-3 rounded-lg border border-gray-700">
          <h3 className="text-sm font-semibold text-cyan-300 mb-2 flex items-center gap-2">
            <span className="text-lg">🔧</span> Synthèse de la Validation IA
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
            {Object.entries(validationStats).map(([status, count]) => {
              const config = validationStatConfig[status] || validationStatConfig.UNVERIFIED;
              return <StatItem key={status} {...config} count={count} />;
            })}
          </div>
        </div>

        {/* Ligne 2: Statistiques de Fact-Checking */}
        {Object.keys(factCheckStats).length > 0 && (
          <div className="bg-black/20 p-3 rounded-lg border border-gray-700">
            <h3 className="text-sm font-semibold text-fuchsia-300 mb-2 flex items-center gap-2">
              <span className="text-lg">🎯</span> Synthèse du Fact-Checking
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
              {Object.entries(factCheckStats).map(([status, count]) => {
                const config = factCheckStatConfig[status] || factCheckStatConfig.UNVERIFIABLE;
                return <StatItem key={status} {...config} count={count} />;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Liste des affirmations - Section scrollable */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto scrollbar-modal p-6 space-y-6"
      >
        {claims.map((claim, index) => {
          const isActive = claim.id === activeClaimId;
          const borderColor = getBorderColor(claim.validationStatus);
          const backgroundColor = getBackgroundColor(claim.validationStatus, isActive);
          
          // --- NOUVELLE LOGIQUE POUR LE BLOC FACT-CHECKING ---
          const isFactCheckSkipped = !claim.verdict && ['HALLUCINATION', 'INACCURATE', 'NOT_VERIFIABLE_CLAIM'].includes(claim.validationStatus);
          
          const getSkipReason = () => {
            switch (claim.validationStatus) {
              case 'HALLUCINATION': return "L'affirmation a été jugée comme une hallucination.";
              case 'INACCURATE': return "L'affirmation a été jugée imprécise.";
              case 'NOT_VERIFIABLE_CLAIM': return "L'affirmation est une opinion ou une question non vérifiable.";
              default: return "Le fact-checking n'a pas été appliqué.";
            }
          };

          return (
            <div
              ref={(el) => (claimRefs.current[claim.id] = el)}
              key={claim.id}
              className={`
                p-6 border-l-4 rounded-r-xl shadow-xl
                transition-all duration-300 cursor-pointer group
                ${isActive
                  ? 'bg-cyan-900/60 !border-cyan-400 scale-[1.02] shadow-cyan-500/30' 
                  : `${backgroundColor} ${borderColor} hover:bg-gray-800/50 hover:scale-[1.01]`
                }
              `}
              onClick={() => onClaimClick(claim.timestamp)}
            >
              {/* En-tête avec numéro et timestamp */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <span className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${isActive 
                      ? 'bg-cyan-400 text-black' 
                      : 'bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/50'
                    }
                  `}>
                    {index + 1}
                  </span>
                  <span className={`
                    text-sm font-mono px-3 py-1 rounded-full transition-colors
                    ${isActive
                      ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/50"
                      : "text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/30"
                    }
                  `}>
                    {new Date(claim.timestamp * 1000).toISOString().substr(14, 5)}
                  </span>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClaimClick(claim.timestamp);
                  }}
                  className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 rounded-lg border border-blue-500/30 text-sm transition-all"
                >
                  ▶ Aller à ce moment
                </button>
              </div>

              {/* Texte de l'affirmation */}
              <div className="mb-4">
                <p className={`text-lg leading-relaxed ${isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                  <span className="text-fuchsia-400 mr-2">"</span>
                  {claim.text}
                  <span className="text-fuchsia-400 ml-2">"</span>
                </p>
              </div>
              
              {/* --- SECTION PRINCIPALE REFAITE : Fact-checking détaillé --- */}
              <div className="mb-4">
                {claim.verdict ? (
                  // CAS 1: Fact-check terminé
                  <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-2xl">🎯</div>
                      <h3 className="text-lg font-bold text-cyan-300">Résultat du Fact-Checking</h3>
                    </div>
                    <FactCheckIcon claim={claim} extended={true} />
                  </div>
                ) : isFactCheckSkipped ? (
                  // CAS 2: Fact-check non applicable
                  <div className="bg-gray-800/40 border border-dashed border-gray-600/50 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-xl text-gray-400">🚫</div>
                      <h3 className="text-lg font-bold text-gray-400">Fact-Checking Non Applicable</h3>
                    </div>
                    <p className="text-sm text-gray-400 pl-8">{getSkipReason()}</p>
                  </div>
                ) : (
                  // CAS 3: Fact-check en attente ou non activé
                  <div className="bg-gradient-to-r from-gray-900/30 to-gray-800/30 border border-gray-600/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-xl">⏳</div>
                      <h3 className="text-lg font-bold text-gray-300">Fact-checking en attente...</h3>
                    </div>
                    <p className="text-sm text-gray-400">Cette affirmation sera vérifiée si l'option est activée et si elle est jugée valide.</p>
                  </div>
                )}
              </div>

              {/* SECTION SECONDAIRE : Validation technique discrète */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-gray-600">🔧</span>
                <span>Validation IA:</span>
                <ValidationIcon claim={claim} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ExpandedClaimList;
