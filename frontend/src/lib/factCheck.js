// Configuration et helpers partagés pour l'affichage du fact-checking
// et de la validation des affirmations. Source unique de vérité pour
// les libellés, les couleurs (tons) et les icônes.

export function formatTimestamp(seconds = 0) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Normalise un score de confiance (accepte 0–1 ou 0–100) -> entier 0–100.
export function toPercent(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null;
  const n = Number(score);
  return Math.round(n <= 1 ? n * 100 : n);
}

// Un "ton" = un paquet de classes Tailwind cohérent (thème sombre).
export const TONES = {
  true: {
    text: 'text-emerald-300',
    border: 'border-emerald-400/40',
    bg: 'bg-emerald-400/10',
    solid: 'bg-emerald-400',
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-400',
    ring: 'ring-emerald-400/30',
    rgb: '52, 211, 153',
  },
  false: {
    text: 'text-rose-300',
    border: 'border-rose-400/40',
    bg: 'bg-rose-400/10',
    solid: 'bg-rose-400',
    dot: 'bg-rose-400',
    bar: 'bg-rose-400',
    ring: 'ring-rose-400/30',
    rgb: '251, 113, 133',
  },
  misleading: {
    text: 'text-amber-300',
    border: 'border-amber-400/40',
    bg: 'bg-amber-400/10',
    solid: 'bg-amber-400',
    dot: 'bg-amber-400',
    bar: 'bg-amber-400',
    ring: 'ring-amber-400/30',
    rgb: '251, 191, 36',
  },
  orange: {
    text: 'text-orange-300',
    border: 'border-orange-400/40',
    bg: 'bg-orange-400/10',
    solid: 'bg-orange-400',
    dot: 'bg-orange-400',
    bar: 'bg-orange-400',
    ring: 'ring-orange-400/30',
    rgb: '251, 146, 60',
  },
  unverifiable: {
    text: 'text-slate-300',
    border: 'border-slate-400/30',
    bg: 'bg-slate-400/10',
    solid: 'bg-slate-400',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
    ring: 'ring-slate-400/30',
    rgb: '148, 163, 184',
  },
  muted: {
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/10',
    solid: 'bg-slate-500',
    dot: 'bg-slate-500',
    bar: 'bg-slate-500',
    ring: 'ring-slate-500/30',
    rgb: '100, 116, 139',
  },
};

export const getTone = (name) => TONES[name] || TONES.muted;

// Verdicts de fact-checking (ordre = ordre d'affichage des stats).
export const VERDICTS = {
  TRUE: { label: 'True', plural: 'True', tone: 'true', glyph: 'check' },
  FALSE: { label: 'False', plural: 'False', tone: 'false', glyph: 'cross' },
  MISLEADING: { label: 'Misleading', plural: 'Misleading', tone: 'misleading', glyph: 'alert' },
  UNVERIFIABLE: { label: 'Unverifiable', plural: 'Unverifiable', tone: 'unverifiable', glyph: 'help' },
};

// AI validation statuses.
export const VALIDATIONS = {
  VALID: { label: 'Valid', plural: 'Valid', tone: 'true', glyph: 'check' },
  INACCURATE: { label: 'Inaccurate', plural: 'Inaccurate', tone: 'misleading', glyph: 'alert' },
  OUT_OF_CONTEXT: { label: 'Out of context', plural: 'Out of context', tone: 'orange', glyph: 'search' },
  HALLUCINATION: { label: 'Hallucination', plural: 'Hallucinations', tone: 'false', glyph: 'ghost' },
  NOT_VERIFIABLE_CLAIM: { label: 'Not verifiable', plural: 'Not verifiable', tone: 'unverifiable', glyph: 'message' },
  UNVERIFIED: { label: 'Unverified', plural: 'Unverified', tone: 'muted', glyph: 'dots' },
};

export const getVerdict = (v) => VERDICTS[v] || VERDICTS.UNVERIFIABLE;
export const getValidation = (v) => VALIDATIONS[v] || VALIDATIONS.UNVERIFIED;

// États de validation pour lesquels le fact-checking est volontairement ignoré.
export const FACTCHECK_SKIP_STATES = ['HALLUCINATION', 'INACCURATE', 'NOT_VERIFIABLE_CLAIM'];

export function isFactCheckSkipped(claim) {
  return !claim?.verdict && FACTCHECK_SKIP_STATES.includes(claim?.validationStatus);
}

export function getSkipReason(status) {
  switch (status) {
    case 'HALLUCINATION':
      return 'Flagged as a hallucination by the AI — so it was not verified.';
    case 'INACCURATE':
      return 'Flagged as inaccurate by the AI — so it was not verified.';
    case 'NOT_VERIFIABLE_CLAIM':
      return 'Opinion or non-verifiable question — so it was not fact-checked.';
    default:
      return 'Fact-checking was not applied to this claim.';
  }
}
