import React from 'react';

function ClaimList({ claims }) {
  if (!claims || claims.length === 0) {
    return (
      <div className="text-center text-gray-400 p-4 border border-dashed border-gray-700 rounded-lg">
        Aucune affirmation factuelle n'a été extraite de cette vidéo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-lg text-gray-200">Affirmations Extraites</h3>
      <ul className="space-y-3">
        {claims.map((claim) => (
          <li key={claim.id} className="bg-gray-800/50 p-4 border border-gray-700 rounded-lg shadow">
            <p className="text-gray-300">"{claim.text}"</p>
            {/* Emplacement pour les futurs indicateurs de vérification */}
            <div className="text-right mt-2">
                <span className="text-xs text-gray-500 font-mono">Vérification en attente...</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ClaimList;