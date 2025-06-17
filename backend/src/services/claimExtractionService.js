const { OpenAI } = require('openai');
const prisma = require('../client'); // On importe une instance partagée de Prisma
const fs = require('fs');
const path = require('path');

// Configuration du client pour OpenRouter
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, // Assurez-vous d'ajouter cette clé à votre .env
});

// --- CHARGEMENT DYNAMIQUE DU PROMPT ---
// On lit le prompt depuis un fichier externe pour une modification facile.
const promptPath = path.join(__dirname, '../prompts/claim_extraction.prompt.txt');
const SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf-8');

/**
 * Extrait les affirmations factuelles d'une transcription.
 * @param {string} fullText - Le texte complet de la transcription.
 * @returns {Promise<Array<string>>} Un tableau des affirmations extraites.
 */
async function extractClaimsFromText(fullText) {
  // Pour l'instant, on ne gère pas le "chunking". On suppose que le texte est assez court.
  // TODO: Implémenter une stratégie de découpage pour les textes longs.
  console.log('Envoi de la transcription au LLM pour extraction...');

  // --- LECTURE DYNAMIQUE DU MODÈLE ---
  // On lit le nom du modèle depuis les variables d'environnement, avec une valeur par défaut.
  const model = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";
  console.log(`Envoi de la transcription au LLM (Modèle: ${model}) pour extraction...`);

  const response = await openrouter.chat.completions.create({
    model: model, // Utilisation de la variable
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: fullText }
    ],
    response_format: { type: "json_object" },
  });

  const rawJson = response.choices[0].message.content;
  console.log('Réponse JSON brute du LLM reçue.');

  try {
    const parsed = JSON.parse(rawJson);
    // On valide que la réponse a le bon format
    if (!parsed.claims || !Array.isArray(parsed.claims)) {
      throw new Error("La réponse du LLM n'a pas le format attendu { claims: [...] }");
    }
    // On extrait uniquement le texte de chaque 'claim'
    return parsed.claims.map(c => c.claim).filter(Boolean);
  } catch (e) {
    console.error("Erreur de parsing de la réponse JSON du LLM:", e);
    console.error("Réponse brute reçue:", rawJson);
    throw new Error("N'a pas pu parser la réponse du service d'IA.");
  }
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


module.exports = { extractClaimsFromText, mockExtractClaimsFromText };