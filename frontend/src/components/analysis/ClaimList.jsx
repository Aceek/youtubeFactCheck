import React from 'react';

function ClaimList({ claims, onClaimClick }) {
  if (!claims || claims.length === 0) {
    return (
      <div className="text-center text-cyan-200/70 p-8 border-2 border-dashed border-cyan-400/20 rounded-xl bg-black/20">
        <p className="text-lg">Aucune affirmation factuelle n'a été extraite.</p>
        <p className="text-sm">Cela peut se produire si la vidéo ne contient pas de dialogue clair ou si l'analyse est encore en cours.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-4 max-h-[500px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-fuchsia-500/50 scrollbar-track-black/30">
        {claims.map((claim) => (
          <li
            key={claim.id}
            onClick={() => onClaimClick(claim.timestamp)}
            className="bg-gray-900/50 p-5 border-l-4 border-fuchsia-500 rounded-r-lg shadow-lg hover:bg-gray-800/70 hover:shadow-fuchsia-500/20 transition-all duration-300 cursor-pointer group"
          >
            <p className="text-lg text-gray-200 group-hover:text-white">"{claim.text}"</p>
            <div className="text-right mt-3">
              <span className="text-sm font-mono text-fuchsia-400 bg-black/30 px-2 py-1 rounded">
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