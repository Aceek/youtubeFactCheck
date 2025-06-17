const { OpenAI } = require('openai');
const prisma = require('../client'); // On importe une instance partagée de Prisma

// Configuration du client pour OpenRouter
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, // Assurez-vous d'ajouter cette clé à votre .env
});

// Le "cerveau" de notre extracteur
const SYSTEM_PROMPT = `
Tu es un assistant de recherche objectif et méticuleux. Ta seule tâche est d'analyser le texte fourni et d'extraire toutes les affirmations factuelles qui peuvent être vérifiées.
Ignore les opinions, les questions, les anecdotes personnelles et le langage subjectif.
Concentre-toi sur les données concrètes : statistiques, noms, dates, événements, déclarations directes.
Ta réponse doit être UNIQUEMENT un objet JSON valide, sans aucun texte explicatif avant ou après.
Le JSON doit avoir une seule clé "claims", qui contient un tableau d'objets. Chaque objet représente une affirmation et doit avoir une seule clé "claim" contenant le texte de l'affirmation.
Exemple de sortie : {"claims": [{"claim": "La Tour Eiffel a été achevée en 1889."}, {"claim": "La distance Terre-Lune est d'environ 384 400 km."}]}
Si tu ne trouves aucune affirmation factuelle, retourne un tableau vide : {"claims": []}
`;

/**
 * Extrait les affirmations factuelles d'une transcription.
 * @param {string} fullText - Le texte complet de la transcription.
 * @returns {Promise<Array<string>>} Un tableau des affirmations extraites.
 */
async function extractClaimsFromText(fullText) {
  // Pour l'instant, on ne gère pas le "chunking". On suppose que le texte est assez court.
  // TODO: Implémenter une stratégie de découpage pour les textes longs.
  console.log('Envoi de la transcription au LLM pour extraction...');

  const response = await openrouter.chat.completions.create({
    model: "mistralai/mistral-7b-instruct:free",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: fullText }
    ],
    response_format: { type: "json_object" }, // On force le LLM à répondre en JSON
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

module.exports = { extractClaimsFromText };