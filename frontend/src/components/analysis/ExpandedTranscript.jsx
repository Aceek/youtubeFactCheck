import React, { useState, useMemo } from 'react';

function ExpandedTranscript({ transcription, onTimestampClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Fonction pour formater le timestamp
  const formatTimestamp = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Diviser le texte en segments avec timestamps (simulation)
  const segments = useMemo(() => {
    if (!transcription?.fullText) return [];
    
    const text = transcription.fullText;
    const words = text.split(' ');
    const segments = [];
    const wordsPerSegment = 15; // Environ 15 mots par segment
    
    for (let i = 0; i < words.length; i += wordsPerSegment) {
      const segmentWords = words.slice(i, i + wordsPerSegment);
      const segmentText = segmentWords.join(' ');
      const timestamp = Math.floor((i / words.length) * 600); // Estimation sur 10 minutes
      
      segments.push({
        id: i,
        text: segmentText,
        timestamp: timestamp,
        startIndex: i,
        endIndex: i + wordsPerSegment - 1
      });
    }
    
    return segments;
  }, [transcription]);

  // Recherche dans le texte
  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return segments;
    
    return segments.filter(segment => 
      segment.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [segments, searchTerm]);

  // Fonction pour surligner le texte de recherche
  const highlightText = (text, searchTerm) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-400/30 text-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Navigation dans les résultats de recherche
  const navigateSearch = (direction) => {
    if (filteredSegments.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = highlightedIndex >= filteredSegments.length - 1 ? 0 : highlightedIndex + 1;
    } else {
      newIndex = highlightedIndex <= 0 ? filteredSegments.length - 1 : highlightedIndex - 1;
    }
    
    setHighlightedIndex(newIndex);
    
    // Scroll vers l'élément
    const element = document.getElementById(`segment-${filteredSegments[newIndex].id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!transcription?.fullText) {
    return (
      <div className="text-center text-cyan-200/70 p-12 border-2 border-dashed border-cyan-400/20 rounded-xl bg-black/20">
        <div className="text-6xl mb-4">📝</div>
        <p className="text-xl mb-2">Aucune transcription disponible</p>
        <p className="text-sm text-gray-400">
          La transcription n'a pas encore été générée ou a échoué.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Barre de recherche - Section fixe */}
      <div className="flex-shrink-0 p-6 border-b border-gray-700/50 bg-gray-900/50">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Rechercher dans la transcription..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(-1);
              }}
              className="w-full px-4 py-2 bg-black/50 border border-cyan-400/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {searchTerm && filteredSegments.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {highlightedIndex + 1} / {filteredSegments.length}
              </span>
              <button
                onClick={() => navigateSearch('prev')}
                className="p-2 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 rounded border border-cyan-500/30 transition-all"
                title="Résultat précédent"
              >
                ↑
              </button>
              <button
                onClick={() => navigateSearch('next')}
                className="p-2 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 rounded border border-cyan-500/30 transition-all"
                title="Résultat suivant"
              >
                ↓
              </button>
            </div>
          )}
        </div>
        
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-400">
            {filteredSegments.length > 0 
              ? `${filteredSegments.length} résultat(s) trouvé(s)`
              : 'Aucun résultat trouvé'
            }
          </div>
        )}
      </div>

      {/* Statistiques - Section fixe */}
      <div className="flex-shrink-0 p-6 border-b border-gray-700/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/30 p-4 rounded-lg border border-cyan-400/20">
            <div className="text-2xl font-bold text-cyan-400">{transcription.fullText.split(' ').length}</div>
            <div className="text-sm text-gray-400">Mots au total</div>
          </div>
          <div className="bg-black/30 p-4 rounded-lg border border-fuchsia-400/20">
            <div className="text-2xl font-bold text-fuchsia-400">{segments.length}</div>
            <div className="text-sm text-gray-400">Segments</div>
          </div>
          <div className="bg-black/30 p-4 rounded-lg border border-green-400/20">
            <div className="text-2xl font-bold text-green-400">
              {Math.ceil(transcription.fullText.length / 1000)}min
            </div>
            <div className="text-sm text-gray-400">Temps de lecture estimé</div>
          </div>
        </div>
      </div>

      {/* Transcription segmentée - Section scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-modal p-6 space-y-4">
        {(searchTerm ? filteredSegments : segments).map((segment, index) => {
          const isHighlighted = searchTerm && index === highlightedIndex;
          
          return (
            <div
              key={segment.id}
              id={`segment-${segment.id}`}
              className={`
                p-4 rounded-lg border-l-4 transition-all duration-300 cursor-pointer group
                ${isHighlighted 
                  ? 'bg-yellow-500/20 border-yellow-400 scale-[1.02] shadow-lg shadow-yellow-500/20' 
                  : 'bg-gray-900/40 border-cyan-400/30 hover:bg-gray-800/60 hover:border-cyan-400/60'
                }
              `}
              onClick={() => onTimestampClick && onTimestampClick(segment.timestamp)}
            >
              <div className="flex justify-between items-start gap-4 mb-2">
                <span className="text-sm font-mono px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                  {formatTimestamp(segment.timestamp)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTimestampClick && onTimestampClick(segment.timestamp);
                  }}
                  className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 rounded text-xs border border-blue-500/30 transition-all opacity-0 group-hover:opacity-100"
                >
                  ▶ Aller
                </button>
              </div>
              
              <p className="text-gray-200 leading-relaxed group-hover:text-white transition-colors">
                {highlightText(segment.text, searchTerm)}
              </p>
            </div>
          );
        })}
        {/* Mode texte complet - Intégré dans la zone scrollable */}
        <div className="border-t border-gray-700/50 pt-6 mt-8">
          <h3 className="text-lg font-semibold text-cyan-300 mb-4 flex items-center gap-2">
            <span>📄</span>
            Transcription complète
          </h3>
          <div className="bg-gray-900/60 p-6 rounded-lg border border-gray-700">
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {highlightText(transcription.fullText, searchTerm)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExpandedTranscript;