const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
// Le client Prisma n'est plus nécessaire ici
// const prisma = require('../client');

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
// --- CHARGEMENT DYNAMIQUE DU PROMPT ---
// On lit le prompt depuis un fichier externe pour une modification facile.
const promptPath = path.join(__dirname, '../prompts/claim_extraction.prompt.txt');
const SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf-8');

/**
 * MODIFICATION : Extrait les affirmations ET leur horodatage approximatif.
 * @param {Array<object>} structuredTranscript - La transcription structurée d'AssemblyAI (avec les mots et leurs timestamps).
 * @returns {Promise<Array<{text: string, timestamp: number}>>} Un tableau d'objets "claim".
 */
async function extractClaimsWithTimestamps(structuredTranscript) {
  const fullText = structuredTranscript.map(word => word.text).join(' ');
  const model = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";
  
  console.log(`Envoi de la transcription au LLM (Modèle: ${model}) pour extraction...`);
  const response = await openrouter.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: fullText }
    ],
    response_format: { type: "json_object" },
  });

  const rawJson = response.choices[0].message.content;
  let parsedClaims = [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed.claims || !Array.isArray(parsed.claims)) throw new Error("Format JSON invalide");
    parsedClaims = parsed.claims.map(c => c.claim).filter(Boolean);
  } catch (e) {
    console.error("Erreur de parsing de la réponse JSON du LLM:", e);
    throw new Error("N'a pas pu parser la réponse du service d'IA.");
  }
  
  console.log(`${parsedClaims.length} affirmations brutes extraites. Recherche des timestamps...`);

  // --- NOUVELLE LOGIQUE : Trouver l'horodatage pour chaque "claim" ---
  const claimsWithTimestamps = parsedClaims.map(claimText => {
    // On nettoie le texte du claim pour une meilleure correspondance
    const cleanClaimText = claimText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
    
    // On cherche la première occurrence du premier mot du claim dans la transcription
    const firstWord = cleanClaimText.split(' ')[0];
    const wordIndex = structuredTranscript.findIndex(word => word.text.toLowerCase().includes(firstWord));

    if (wordIndex !== -1) {
      // On a trouvé le mot ! On prend son horodatage de début en millisecondes.
      const timestampMs = structuredTranscript[wordIndex].start;
      return { text: claimText, timestamp: Math.round(timestampMs / 1000) }; // On convertit en secondes
    }
    
    // Si on ne trouve pas de correspondance, on met un timestamp par défaut
    return { text: claimText, timestamp: 0 };
  });

  return claimsWithTimestamps;
}

/**
 * Simule l'extraction des "claims".
 * @returns {Promise<Array<string>>} Un tableau d'affirmations simulées.
 */
async function mockExtractClaimsFromText() {
  console.log('MOCK_CLAIM_EXTRACTOR: Démarrage de l\'extraction simulée.');
  
  // On cherche des affirmations ("claims") déjà existantes dans la base de données.
  const existingClaims = await prisma.claim.findMany({ take: 10 }); // On en prend 10 pour l'exemple

  if (existingClaims.length < 3) { // On s'assure d'avoir un minimum de données pour que le mock soit utile
    console.warn("MOCK_CLAIM_EXTRACTOR: Pas assez de 'claims' en BDD. Retourne des données par défaut.");
    return [
      "Ceci est une première affirmation simulée.",
      "Une deuxième affirmation de test est apparue.",
      "La simulation est un succès."
    ];
  }

  // On en choisit 3 au hasard pour simuler une réponse variable.
  const shuffled = existingClaims.sort(() => 0.5 - Math.random());
  const selectedClaims = shuffled.slice(0, 3).map(c => c.text);
  
  console.log(`MOCK_CLAIM_EXTRACTOR: Utilisation de ${selectedClaims.length} 'claims' existants.`);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simule un délai de 1.5s pour le LLM

  console.log('MOCK_CLAIM_EXTRACTOR: ✅ Extraction simulée terminée !');
  return selectedClaims;
}


module.exports = { extractClaimsWithTimestamps, mockExtractClaimsFromText: () => Promise.resolve([]) };