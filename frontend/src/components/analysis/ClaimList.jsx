import React from 'react';

// Le composant reçoit maintenant une fonction onClaimClick
function ClaimList({ claims, onClaimClick }) {
  if (!claims || claims.length === 0) {
    return (
      <div className="text-center text-gray-400 p-4 border border-dashed border-gray-700 rounded-lg">
        Aucune affirmation factuelle n'a été extraite de cette vidéo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3 max-h-[80vh] overflow-y-auto">
        {claims.map((claim) => (
          // On ajoute un gestionnaire d'événement onClick
          <li
            key={claim.id}
            onClick={() => onClaimClick(claim.timestamp)}
            className="bg-gray-800/50 p-4 border border-gray-700 rounded-lg shadow-md hover:bg-gray-700/50 hover:border-cyan-500 transition-all cursor-pointer"
          >
            <p className="text-gray-300">"{claim.text}"</p>
            <div className="text-right mt-2">
              {/* On peut afficher l'horodatage pour le debug */}
              <span className="text-xs text-cyan-400 font-mono">
                à {new Date(claim.timestamp * 1000).toISOString().substr(14, 5)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ClaimList;