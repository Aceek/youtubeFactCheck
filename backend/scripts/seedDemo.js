// backend/scripts/seedDemo.js
//
// Amorce la base avec une analyse COMPLETE realiste, sans aucune cle API.
// Sert deux scenarios de demo :
//   1. Mode "Demo (Rapide)" / MOCK_PROVIDER : rejoue la transcription + pioche
//      des claims existants (ce script en cree suffisamment).
//   2. Mode "Analyse Complete (IA)" : si on resoumet l'URL ci-dessous avec le
//      meme OPENROUTER_MODEL, le backend renvoie cette analyse depuis son cache,
//      donc tout le rendu riche (verdicts, sources, score) s'affiche sans API.
//
// Usage (dans le conteneur backend) :
//   node scripts/seedDemo.js [URL_YOUTUBE]
// L'URL par defaut est un placeholder : passe ta propre video en 1er argument
// pour que le lecteur embarque la bonne video.

const prisma = require('../src/client');

const DEFAULT_URL =
  process.argv[2] || 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

// Doit correspondre a OPENROUTER_MODEL du .env pour declencher le cache HIT.
const LLM_MODEL = process.env.OPENROUTER_MODEL || 'moonshotai/kimi-dev-72b:free';

function extractVideoId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : 'jNQXAC9IVRw';
}

const FULL_TEXT = [
  "Mes chers concitoyens, je veux ce soir vous parler avec des chiffres, parce que les faits comptent plus que les promesses.",
  "Notre pays demeure la premiere destination touristique au monde, et nous devons en etre fiers : c'est le fruit de notre patrimoine et du travail de nos territoires.",
  "Mais la situation budgetaire exige de la lucidite. La dette publique a depasse trois mille milliards d'euros, et nous ne pouvons plus faire comme si ce mur n'existait pas.",
  "Notre modele energetique reste une force : la majorite de notre electricite provient du nucleaire, ce qui nous protege en partie de la flambee des prix du gaz.",
  "Sur l'emploi, je le dis clairement : le chomage recule, mais aucun foyer ne doit etre laisse au bord du chemin, et nous restons mobilises.",
  "Enfin, l'agriculture est notre fierte. Je veux que la France reste un grand pays exportateur, capable de nourrir les Francais et de peser en Europe.",
].join('\n\n');

// Paragraphes facon AssemblyAI (start/end en millisecondes).
const PARAGRAPHS = [
  { text: FULL_TEXT.split('\n\n')[0], start: 2000, end: 11000 },
  { text: FULL_TEXT.split('\n\n')[1], start: 11000, end: 24000 },
  { text: FULL_TEXT.split('\n\n')[2], start: 24000, end: 41000 },
  { text: FULL_TEXT.split('\n\n')[3], start: 41000, end: 58000 },
  { text: FULL_TEXT.split('\n\n')[4], start: 58000, end: 74000 },
  { text: FULL_TEXT.split('\n\n')[5], start: 74000, end: 92000 },
];

// Quelques "mots" horodatés (le mock provider et la transcription en attendent un tableau).
const WORDS = PARAGRAPHS.flatMap((p) => {
  const tokens = p.text.split(/\s+/).filter(Boolean);
  const span = (p.end - p.start) / tokens.length;
  return tokens.map((w, i) => ({
    text: w,
    start: Math.round(p.start + i * span),
    end: Math.round(p.start + (i + 1) * span),
    confidence: 0.95,
  }));
});

// 10 affirmations couvrant tout l'eventail de statuts/verdicts pour la demo UI.
const CLAIMS = [
  {
    text: "La France est la premiere destination touristique au monde.",
    timestamp: 13,
    validationStatus: 'VALID',
    validationExplanation:
      "L'affirmation est fidele a la source : l'orateur revendique bien ce statut.",
    validationScore: 0.93,
    verdict: 'TRUE',
    verdictReason:
      "Confirme par les donnees de l'Organisation mondiale du tourisme : la France est en tete des arrivees de touristes internationaux.",
    sources: [
      { title: "OMT - Faits saillants du tourisme international", url: 'https://www.unwto.org/' },
      { title: 'Wikipedia - Tourisme en France', url: 'https://fr.wikipedia.org/wiki/Tourisme_en_France' },
    ],
  },
  {
    text: "La dette publique de la France a depasse 3000 milliards d'euros.",
    timestamp: 28,
    validationStatus: 'VALID',
    validationExplanation: "Citation exacte de l'orateur, bien retranscrite.",
    validationScore: 0.96,
    verdict: 'TRUE',
    verdictReason:
      "Exact : l'INSEE a confirme le franchissement du seuil des 3000 milliards d'euros de dette publique.",
    sources: [
      { title: 'INSEE - Dette publique', url: 'https://www.insee.fr/' },
    ],
  },
  {
    text: "La majorite de l'electricite francaise provient du nucleaire.",
    timestamp: 44,
    validationStatus: 'VALID',
    validationExplanation: "Reformulation fidele du propos sur le mix energetique.",
    validationScore: 0.9,
    verdict: 'TRUE',
    verdictReason:
      "Confirme par RTE : le nucleaire represente environ 65 a 70% de la production d'electricite en France.",
    sources: [
      { title: 'RTE - Bilan electrique', url: 'https://www.rte-france.com/' },
    ],
  },
  {
    text: "Le chomage recule.",
    timestamp: 60,
    validationStatus: 'OUT_OF_CONTEXT',
    validationExplanation:
      "Vrai sur certaines periodes, mais sorti de son contexte la formule masque les variations recentes.",
    validationScore: 0.58,
    verdict: 'MISLEADING',
    verdictReason:
      "Trompeur sans precision de periode : selon l'INSEE le taux de chomage a connu des hausses et des baisses; l'affirmation generale est ambigue.",
    sources: [
      { title: 'INSEE - Taux de chomage', url: 'https://www.insee.fr/fr/statistiques' },
    ],
  },
  {
    text: "La France reste un grand pays exportateur agricole.",
    timestamp: 78,
    validationStatus: 'VALID',
    validationExplanation: "Fidele au propos tenu sur l'agriculture.",
    validationScore: 0.88,
    verdict: 'TRUE',
    verdictReason:
      "Exact : la France figure parmi les premiers exportateurs agricoles de l'Union europeenne.",
    sources: [
      { title: 'Ministere de l Agriculture', url: 'https://agriculture.gouv.fr/' },
    ],
  },
  {
    text: "Le SMIC horaire brut a depasse 15 euros.",
    timestamp: 35,
    validationStatus: 'HALLUCINATION',
    validationExplanation:
      "Cette affirmation n'apparait pas dans la transcription : elle a ete hallucinee.",
    validationScore: 0.82,
    verdict: 'FALSE',
    verdictReason:
      "Faux : le SMIC horaire brut se situe autour de 11 a 12 euros, bien en dessous de 15 euros.",
    sources: [
      { title: 'Service-public.fr - SMIC', url: 'https://www.service-public.fr/' },
    ],
  },
  {
    text: "La France est le premier exportateur agricole d'Europe, devant tous les autres pays.",
    timestamp: 80,
    validationStatus: 'INACCURATE',
    validationExplanation:
      "Le sens a ete durci : l'orateur parle d'un grand pays exportateur, pas explicitement du premier devant tous.",
    validationScore: 0.64,
    verdict: 'MISLEADING',
    verdictReason:
      "Trompeur : en valeur, les Pays-Bas rivalisent voire depassent la France selon les annees et les sources.",
    sources: [
      { title: 'Eurostat - Commerce agroalimentaire', url: 'https://ec.europa.eu/eurostat' },
    ],
  },
  {
    text: "Aucun foyer ne sera laisse au bord du chemin.",
    timestamp: 66,
    validationStatus: 'NOT_VERIFIABLE_CLAIM',
    validationExplanation:
      "Engagement politique et non une affirmation factuelle verifiable.",
    validationScore: 0.71,
    verdict: 'UNVERIFIABLE',
    verdictReason:
      "Non verifiable : il s'agit d'une promesse d'intention, sans donnee mesurable a confronter.",
    sources: [],
  },
  {
    text: "Le patrimoine et les territoires expliquent l'attractivite touristique.",
    timestamp: 16,
    validationStatus: 'VALID',
    validationExplanation: "Reformulation fidele de l'explication donnee.",
    validationScore: 0.85,
    verdict: 'UNVERIFIABLE',
    verdictReason:
      "Affirmation d'opinion/causalite difficile a trancher factuellement de maniere binaire.",
    sources: [],
  },
  {
    text: "Le modele nucleaire protege la France de la flambee des prix du gaz.",
    timestamp: 50,
    validationStatus: 'VALID',
    validationExplanation: "Fidele au propos, avec une nuance ('en partie').",
    validationScore: 0.8,
    verdict: 'TRUE',
    verdictReason:
      "Plausible et documente : un mix electrique peu dependant du gaz reduit l'exposition aux prix du gaz, meme si le couplage des marches europeens nuance l'effet.",
    sources: [
      { title: 'Commission de regulation de l energie', url: 'https://www.cre.fr/' },
    ],
  },
];

async function main() {
  const url = DEFAULT_URL;
  const videoId = extractVideoId(url);
  console.log(`Seed demo: videoId=${videoId}, model=${LLM_MODEL}`);

  // Nettoyage d'une eventuelle precedente demo pour ce videoId (idempotent).
  const existing = await prisma.analysis.findMany({
    where: { videoId },
    select: { id: true },
  });
  const ids = existing.map((a) => a.id);
  if (ids.length) {
    await prisma.claim.deleteMany({ where: { analysisId: { in: ids } } });
    await prisma.transcription.deleteMany({ where: { analysisId: { in: ids } } });
    await prisma.analysis.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.video.upsert({
    where: { id: videoId },
    update: {
      title: "Allocution : la France en chiffres (demo SOPAI)",
      author: 'Chaine officielle (demo)',
      description:
        "Extrait de demonstration utilise pour illustrer le pipeline de fact-checking : transcription, extraction d'affirmations, validation et verdicts sources.",
      publishedAt: new Date('2024-09-12T19:00:00Z'),
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    },
    create: {
      id: videoId,
      youtubeUrl: url,
      title: "Allocution : la France en chiffres (demo SOPAI)",
      author: 'Chaine officielle (demo)',
      description:
        "Extrait de demonstration utilise pour illustrer le pipeline de fact-checking : transcription, extraction d'affirmations, validation et verdicts sources.",
      publishedAt: new Date('2024-09-12T19:00:00Z'),
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    },
  });

  const analysis = await prisma.analysis.create({
    data: {
      videoId,
      status: 'COMPLETE',
      llmModel: LLM_MODEL,
      progress: 100,
      confidenceScore: 0.62,
      transcription: {
        create: {
          provider: 'ASSEMBLY_AI',
          fullText: FULL_TEXT,
          content: { words: WORDS, paragraphs: PARAGRAPHS },
        },
      },
      claims: {
        create: CLAIMS.map((c) => ({
          text: c.text,
          timestamp: c.timestamp,
          validationStatus: c.validationStatus,
          validationExplanation: c.validationExplanation,
          validationScore: c.validationScore,
          factCheckStatus: 'COMPLETED',
          verdict: c.verdict,
          verdictReason: c.verdictReason,
          sources: c.sources,
        })),
      },
    },
    include: { claims: true, transcription: true },
  });

  console.log(
    `OK -> analyse ${analysis.id} | ${analysis.claims.length} claims | transcription ${analysis.transcription.id}`
  );
  console.log(`URL de demo a coller dans le formulaire : ${url}`);
  console.log(
    `   - Mode "Analyse Complete (IA)" => renvoie cette analyse depuis le cache (rendu riche complet).`
  );
  console.log(
    `   - Mode "Demo (Rapide)" => rejoue la transcription + 3 claims piochés.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
