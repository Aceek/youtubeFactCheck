import { useState, useMemo } from 'react';
import Icon from '../common/Icon';
import { formatTimestamp } from '../../lib/factCheck';

function ExpandedTranscript({ transcription, onTimestampClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const segments = useMemo(() => {
    if (!transcription?.fullText) return [];
    const words = transcription.fullText.split(' ');
    const out = [];
    const wordsPerSegment = 15;
    for (let i = 0; i < words.length; i += wordsPerSegment) {
      out.push({
        id: i,
        text: words.slice(i, i + wordsPerSegment).join(' '),
        timestamp: Math.floor((i / words.length) * 600),
      });
    }
    return out;
  }, [transcription]);

  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [segments, searchTerm]);

  const highlightText = (text, term) => {
    if (!term.trim()) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="rounded bg-brand/30 px-0.5 text-brand-soft">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const navigateSearch = (direction) => {
    if (filteredSegments.length === 0) return;
    let newIndex;
    if (direction === 'next') newIndex = highlightedIndex >= filteredSegments.length - 1 ? 0 : highlightedIndex + 1;
    else newIndex = highlightedIndex <= 0 ? filteredSegments.length - 1 : highlightedIndex - 1;
    setHighlightedIndex(newIndex);
    const element = document.getElementById(`segment-${filteredSegments[newIndex].id}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!transcription?.fullText) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
        <Icon name="doc" className="h-10 w-10 text-faint" />
        <p className="text-lg text-muted">No transcript available</p>
        <p className="text-sm text-faint">The transcript hasn't been generated yet, or it failed.</p>
      </div>
    );
  }

  const wordCount = transcription.fullText.split(' ').length;
  const readMinutes = Math.ceil(transcription.fullText.length / 1000);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Recherche */}
      <div className="shrink-0 border-b border-line p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="text"
              placeholder="Search the transcript…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(-1);
              }}
              className="field !py-2.5 !pl-10 text-sm"
            />
          </div>
          {searchTerm && filteredSegments.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-faint">
                {highlightedIndex + 1} / {filteredSegments.length}
              </span>
              <button onClick={() => navigateSearch('prev')} className="btn-ghost !p-2" title="Previous result">
                <Icon name="chevronUp" className="h-4 w-4" />
              </button>
              <button onClick={() => navigateSearch('next')} className="btn-ghost !p-2" title="Next result">
                <Icon name="chevronDown" className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {searchTerm && (
          <p className="mt-2 text-xs text-faint">
            {filteredSegments.length > 0 ? `${filteredSegments.length} result(s) found` : 'No results found'}
          </p>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid shrink-0 grid-cols-3 gap-3 border-b border-line p-5">
        <Stat value={wordCount} label="Total words" />
        <Stat value={segments.length} label="Segments" />
        <Stat value={`${readMinutes} min`} label="Est. reading time" />
      </div>

      {/* Segments */}
      <div className="scrollbar-modal flex-1 space-y-3 overflow-y-auto p-5">
        {(searchTerm ? filteredSegments : segments).map((segment, index) => {
          const isHighlighted = searchTerm && index === highlightedIndex;
          return (
            <div
              key={segment.id}
              id={`segment-${segment.id}`}
              onClick={() => onTimestampClick && onTimestampClick(segment.timestamp)}
              className={`group cursor-pointer rounded-xl border border-l-[3px] p-4 transition-all duration-200 ${
                isHighlighted
                  ? 'border-brand/60 border-l-brand bg-brand/10'
                  : 'border-line border-l-line bg-elevated/40 hover:bg-elevated/70'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-base/50 px-2 py-1 font-mono text-xs text-muted">
                  <Icon name="clock" className="h-3 w-3" />
                  {formatTimestamp(segment.timestamp)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-faint opacity-0 transition-opacity group-hover:opacity-100">
                  <Icon name="play" className="h-3 w-3" /> Jump
                </span>
              </div>
              <p className="leading-relaxed text-muted group-hover:text-ink">{highlightText(segment.text, searchTerm)}</p>
            </div>
          );
        })}

        {/* Texte complet */}
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-soft">
            <Icon name="doc" className="h-4 w-4" /> Full transcript
          </h3>
          <div className="rounded-xl border border-line bg-base/40 p-5">
            <p className="leading-relaxed text-muted whitespace-pre-wrap">{highlightText(transcription.fullText, searchTerm)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rounded-xl border border-line bg-base/30 p-3.5 text-center">
      <div className="font-mono text-xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-faint">{label}</div>
    </div>
  );
}

export default ExpandedTranscript;
