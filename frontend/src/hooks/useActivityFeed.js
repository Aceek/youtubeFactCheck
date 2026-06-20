import { useEffect, useRef, useState } from 'react';

// Reconstruit un "flux d'activité" en direct à partir des snapshots successifs
// de l'analyse (reçus via polling). Le backend ne persiste que l'état final de
// chaque claim ; on déduit donc les événements en comparant deux polls :
//   - un claim apparaît          -> événement "extracted"
//   - il reçoit un statut de validation -> "validated"
//   - il reçoit un verdict (+ sources)  -> "verdict"
//
// Chaque événement est émis une seule fois (mémorisé par clé) et reste stable
// pour permettre des animations d'apparition. Le flux se réinitialise quand on
// change d'analyse ou qu'on relance une extraction (claims remis à zéro).

const MAX_EVENTS = 80;

export function useActivityFeed(analysis) {
  const [events, setEvents] = useState([]);

  const emittedRef = useRef(new Set()); // clés déjà émises
  const seqRef = useRef(0); // compteur d'ordre/animation
  const lastIdRef = useRef(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    // Pas d'analyse -> flux vide.
    if (!analysis) {
      emittedRef.current = new Set();
      seqRef.current = 0;
      lastIdRef.current = null;
      lastCountRef.current = 0;
      setEvents([]);
      return;
    }

    const claims = Array.isArray(analysis.claims) ? analysis.claims : [];

    // Réinitialisation : nouvelle analyse, ou ré-extraction (claims vidés).
    const isReset =
      analysis.id !== lastIdRef.current || claims.length < lastCountRef.current;
    if (isReset) {
      emittedRef.current = new Set();
      seqRef.current = 0;
      setEvents([]);
    }
    lastIdRef.current = analysis.id;
    lastCountRef.current = claims.length;

    const emitted = emittedRef.current;
    const fresh = [];

    const push = (key, event) => {
      if (emitted.has(key)) return;
      emitted.add(key);
      fresh.push({ key, seq: seqRef.current++, ...event });
    };

    for (const claim of claims) {
      const base = { claimId: claim.id, timestamp: claim.timestamp, text: claim.text };

      // 1) Claim extrait
      push(`${claim.id}:extracted`, { type: 'extracted', ...base });

      // 2) Validation (on ignore l'état "en attente" UNVERIFIED)
      if (claim.validationStatus && claim.validationStatus !== 'UNVERIFIED') {
        push(`${claim.id}:validated`, {
          type: 'validated',
          validationStatus: claim.validationStatus,
          ...base,
        });
      }

      // 3) Verdict de fact-checking (+ sources cliquables)
      if (claim.verdict) {
        push(`${claim.id}:verdict`, {
          type: 'verdict',
          verdict: claim.verdict,
          sources: Array.isArray(claim.sources) ? claim.sources : [],
          ...base,
        });
      }
    }

    if (fresh.length > 0) {
      setEvents((prev) => {
        const next = [...prev, ...fresh];
        return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
      });
    }
  }, [analysis]);

  return events;
}
