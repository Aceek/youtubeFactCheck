import React, { useMemo, useRef, useEffect } from 'react';
import FactCheckIcon from './FactCheckIcon';

// Icônes de statut avec plus de détails pour le mode étendu
const ValidationIcon = ({ status, explanation, compact = false }) => {
  const icons = {
    VALID: { 
      icon: '✅', 
      color: 'border-green-500', 
      bgColor: 'bg-green-500/10',
      title: 'Valide & Vérifiable',
      description: 'Cette affirmation a été vérifiée et est exacte'
    },
    INACCURATE: { 
      icon: '⚠️', 
      color: 'border-yellow-500', 
      bgColor: 'bg-yellow-500/10',
      title: 'Imprécis',
      description: 'Cette affirmation contient des inexactitudes'
    },
    OUT_OF_CONTEXT: { 
      icon: '🔎', 
      color: 'border-orange-500', 
      bgColor: 'bg-orange-500/10',
      title: 'Hors contexte',
      description: 'Cette affirmation manque de contexte important'
    },
    HALLUCINATION: { 
      icon: '👻', 
      color: 'border-red-500', 
      bgColor: 'bg-red-500/10',
      title: 'Hallucination',
      description: 'Cette affirmation semble être inventée'
    },
    NOT_VERIFIABLE_CLAIM: { 
      icon: '💬', 
      color: 'border-gray-400', 
      bgColor: 'bg-gray-400/10',
      title: 'Non Vérifiable',
      description: 'Cette affirmation ne peut pas être vérifiée objectivement'
    },
    UNVERIFIED: { 
      icon: '…', 
      color: 'border-gray-500', 
      bgColor: 'bg-gray-500/10',
      title: 'Non vérifié',
      description: 'Cette affirmation n\'a pas encore été vérifiée'
    },
  };
  const current = icons[status] || icons.UNVERIFIED;
  
  // Mode compact pour la section secondaire
  if (compact) {
    return (
      <div className="flex items-center gap-1" title={`${current.title}: ${explanation || current.description}`}>
        <span className="text-sm">{current.icon}</span>
        <span className="text-xs text-gray-400">{current.title}</span>
      </div>
    );
  }
  
  // Mode étendu pour la section principale (conservé pour compatibilité)
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${current.bgColor} border ${current.color}`}>
      <span className="text-2xl" title={current.title}>
        {current.icon}
      </span>
      <div className="flex-1">
        <div className="font-semibold text-white">{current.title}</div>
        <div className="text-sm text-gray-300">{current.description}</div>
        {explanation && (
          <div className="text-xs text-gray-400 mt-1 italic">
            "{explanation}"
          </div>
        )}
      </div>
    </div>
  );
};

function ExpandedClaimList({ claims, onClaimClick, currentTime }) {
  const listContainerRef = useRef(null);
  const claimRefs = useRef({});
  claimRefs.current = {};

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

  // Statistiques des affirmations
  const stats = claims.reduce((acc, claim) => {
    acc[claim.validationStatus] = (acc[claim.validationStatus] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Statistiques - Section fixe */}
      <div className="flex-shrink-0 p-6 border-b border-gray-700/50">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(stats).map(([status, count]) => {
            const icons = {
              VALID: { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/20' },
              INACCURATE: { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
              OUT_OF_CONTEXT: { icon: '🔎', color: 'text-orange-400', bg: 'bg-orange-500/20' },
              HALLUCINATION: { icon: '👻', color: 'text-red-400', bg: 'bg-red-500/20' },
              NOT_VERIFIABLE_CLAIM: { icon: '💬', color: 'text-gray-400', bg: 'bg-gray-500/20' },
              UNVERIFIED: { icon: '…', color: 'text-gray-500', bg: 'bg-gray-600/20' },
            };
            const stat = icons[status] || icons.UNVERIFIED;
            
            return (
              <div key={status} className={`${stat.bg} p-3 rounded-lg border border-gray-600/30 text-center`}>
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className={`text-lg font-bold ${stat.color}`}>{count}</div>
                <div className="text-xs text-gray-400 capitalize">{status.toLowerCase().replace('_', ' ')}</div>
              </div>
            );
          })}
        </div>
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

              {/* SECTION PRINCIPALE : Fact-checking détaillé */}
              {claim.verdict ? (
                <div className="mb-4">
                  <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-2xl">🎯</div>
                      <h3 className="text-lg font-bold text-cyan-300">Résultat du Fact-Checking</h3>
                    </div>
                    <FactCheckIcon claim={claim} extended={true} />
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="bg-gradient-to-r from-gray-900/30 to-gray-800/30 border border-gray-600/30 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-xl">⏳</div>
                      <h3 className="text-lg font-bold text-gray-300">Fact-checking en cours...</h3>
                    </div>
                    <p className="text-sm text-gray-400">
                      Cette affirmation est en cours de vérification par nos sources externes.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION SECONDAIRE : Validation technique discrète */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-gray-600">🔧</span>
                <span>Validation IA:</span>
                <ValidationIcon
                  status={claim.validationStatus}
                  explanation={claim.validationExplanation}
                  compact={true}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ExpandedClaimList;