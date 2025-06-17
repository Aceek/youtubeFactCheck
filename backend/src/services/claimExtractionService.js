const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const prisma = require('../client');
const stringSimilarity = require('string-similarity');

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
/**
 * Extrait la première sous-chaîne JSON valide d'une chaîne de caractères potentiellement "polluée".
 * @param {string} str La chaîne de caractères brute renvoyée par le LLM.
 * @returns {string | null} La sous-chaîne JSON ou null si aucune n'est trouvée.
 */
function extractJsonFromString(str) {
    if (!str || typeof str !== 'string') {
        return null;
    }
    // Trouve l'index de la première accolade ouvrante '{' et de la dernière accolade fermante '}'
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        // Si on ne trouve pas une structure JSON valide
        return null;
    }
    // Extrait la sous-chaîne entre ces deux points
    return str.substring(firstBrace, lastBrace + 1);
}

const promptPath = path.join(__dirname, '../prompts/claim_extraction.prompt.txt');
const SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf-8');

function normalizeText(text) {
  return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, ' ').trim();
}

/**
 * AssemblyAI peut retourner des paragraphes ou des "utterances".
 * Cette fonction crée un texte balisé avec des timestamps.
 * @param {object | Array<object>} structuredContent - Le contenu structuré d'AssemblyAI (peut être un objet avec 'words' ou directement un tableau de mots).
 * @returns {string} Le texte balisé pour le LLM.
 */
function createTaggedTranscript(structuredContent) {
    // On vérifie si la structure de paragraphes est disponible
    if (structuredContent.paragraphs && Array.isArray(structuredContent.paragraphs) && structuredContent.paragraphs.length > 0) {
        // NOUVELLE LOGIQUE, BIEN PLUS FIABLE
        let taggedText = structuredContent.paragraphs.map(para => {
            const timestamp = Math.round(para.start / 1000);
            // On ajoute la balise au début de chaque paragraphe
            return `[t=${timestamp}] ${para.text}`;
        }).join('\n\n'); // On sépare les paragraphes pour plus de clarté pour le LLM

        return taggedText.trim();
    }

    // Fallback : ancienne logique mot par mot
    const wordsArray = structuredContent.words || structuredContent;

    if (!Array.isArray(wordsArray)) {
        console.error("createTaggedTranscript: L'input n'est pas un tableau de mots valide.");
        return ""; // Retourner une chaîne vide ou lancer une erreur selon la gestion souhaitée
    }

    let taggedText = "";
    let lastTimestamp = -1;
    const interval = 15000; // 15 secondes en ms

    wordsArray.forEach(word => {
        if (word.start > lastTimestamp + interval) {
            lastTimestamp = word.start;
            taggedText += `[t=${Math.round(word.start / 1000)}] `;
        }
        taggedText += word.text + " ";
    });
    return taggedText.trim();
}

/**
 * Extraction des claims avec sauvegarde du prompt et de la réponse brute pour debug.
 * @param {number} analysisId - L'ID de l'analyse (pour nommer les fichiers)
 * @param {object} structuredTranscript - La transcription structurée (content)
 * @param {string} model - Le nom du modèle LLM utilisé
 */
async function extractClaimsWithTimestamps(analysisId, structuredTranscript, model) {
    // 1. Créer le dossier de debug s'il n'existe pas
    const debugDir = path.resolve('./results');
    fs.mkdirSync(debugDir, { recursive: true });

    // 2. Préparer un préfixe de nom de fichier unique pour cette exécution
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filenamePrefix = `${analysisId}_${timestamp}`;

    // 3. Préparer et sauvegarder le prompt
    const taggedText = createTaggedTranscript(structuredTranscript);
    if (!taggedText) {
        console.error("Transcription balisée vide. Impossible de procéder.");
        return [];
    }

    const promptFilePath = path.join(debugDir, `${filenamePrefix}_prompt-sent.txt`);
    fs.writeFileSync(promptFilePath, `--- PROMPT ENVOYÉ AU MODÈLE : ${model} ---\n\n${taggedText}`);
    console.log(`Prompt sauvegardé pour débogage dans : ${promptFilePath}`);

    // 4. Appeler le LLM et sauvegarder la réponse BRUTE
    let rawJson = null;
    try {
        const response = await openrouter.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: taggedText }
            ],
            response_format: { type: "json_object" },
        });

        rawJson = response.choices[0].message.content;

        // On sauvegarde la réponse IMMÉDIATEMENT, qu'elle soit valide ou non
        const responseFilePath = path.join(debugDir, `${filenamePrefix}_llm-response_SUCCESS.txt`);
        fs.writeFileSync(responseFilePath, rawJson);
        console.log(`Réponse LLM sauvegardée pour débogage dans : ${responseFilePath}`);

        // 5. Tenter de parser le JSON (c'est ici que l'erreur se produit)
        // On nettoie la réponse AVANT de la parser.
        const cleanedJson = extractJsonFromString(rawJson);

        if (!cleanedJson) {
            throw new Error("Aucun objet JSON valide n'a pu être extrait de la réponse du LLM.");
        }

        const parsedData = JSON.parse(cleanedJson); // On parse la chaîne nettoyée !
        if (!parsedData.claims || !Array.isArray(parsedData.claims)) {
            throw new Error("Le JSON parsé n'a pas la structure attendue.");
        }

        console.log(`${parsedData.claims.length} affirmations brutes extraites. Raffinage des timestamps...`);

        // Raffinage des timestamps (inchangé)
        const claimsWithTimestamps = parsedData.claims.map(claimData => {
            const { claim: claimText, estimated_timestamp } = claimData;
            if (typeof estimated_timestamp !== 'number') {
                return { text: claimText, timestamp: 0 };
            }

            // Créer une fenêtre de recherche (ex: -5s à +20s autour de l'estimation)
            const searchWindowStart = Math.max(0, estimated_timestamp - 5);
            const searchWindowEnd = estimated_timestamp + 20;

            // Utiliser le même tableau de mots que celui passé à createTaggedTranscript
            const wordsArray = structuredTranscript.words || structuredTranscript;

            const windowWords = wordsArray.filter(word => {
                const wordTime = word.start / 1000;
                return wordTime >= searchWindowStart && wordTime <= searchWindowEnd;
            });

            if (windowWords.length === 0) {
                return { text: claimText, timestamp: estimated_timestamp };
            }

            // Appliquer le "fuzzy matching" uniquement dans cette fenêtre
            const windowText = windowWords.map(w => w.text).join(' ');
            const { bestMatch } = stringSimilarity.findBestMatch(normalizeText(claimText), [normalizeText(windowText)]);

            const CONFIDENCE_THRESHOLD = 0.6;
            if (bestMatch.rating >= CONFIDENCE_THRESHOLD) {
                console.log(`✅ Raffinage réussi pour "${claimText.substring(0,20)}..." (Score: ${bestMatch.rating.toFixed(2)})`);
                return { text: claimText, timestamp: Math.round(windowWords[0].start / 1000) };
            }

            console.warn(`⚠️ Échec du raffinage pour "${claimText.substring(0,20)}...". Utilisation du timestamp estimé.`);
            return { text: claimText, timestamp: estimated_timestamp };
        });

        return claimsWithTimestamps;

    } catch (e) {
        console.error("Erreur de parsing ou d'appel LLM:", e.message);

        // Si une réponse a quand même été reçue mais est invalide
        if (rawJson) {
            const errorFilePath = path.join(debugDir, `${filenamePrefix}_llm-response_FAILED.txt`);
            fs.writeFileSync(errorFilePath, rawJson);
            console.error(`Réponse LLM INVALIDE sauvegardée pour débogage dans : ${errorFilePath}`);
        }

        throw new Error("N'a pas pu parser la réponse du service d'IA.");
    }
}


/**
 * MODIFICATION : Simule l'extraction des "claims" avec des timestamps.
 * @returns {Promise<Array<{text: string, timestamp: number}>>} Un tableau d'objets "claim" simulés.
 */
async function mockExtractClaimsFromText() {
  console.log('MOCK_CLAIM_EXTRACTOR: Démarrage de l\'extraction simulée.');
  
  const defaultClaims = [
    { text: "Ceci est une première affirmation simulée.", timestamp: 10 },
    { text: "Une deuxième affirmation de test est apparue.", timestamp: 25 },
    { text: "La simulation est un succès.", timestamp: 42 }
  ];

  const existingClaims = await prisma.claim.findMany({
    take: 10,
    where: { timestamp: { gt: 0 } } // On prend des 'claims' qui ont un vrai timestamp
  });

  if (existingClaims.length < 3) {
    console.warn("MOCK_CLAIM_EXTRACTOR: Pas assez de 'claims' en BDD. Retourne des données par défaut.");
    return defaultClaims;
  }

  const shuffled = existingClaims.sort(() => 0.5 - Math.random());
  const selectedClaims = shuffled.slice(0, 3).map(c => ({ text: c.text, timestamp: c.timestamp }));
  
  console.log(`MOCK_CLAIM_EXTRACTOR: Utilisation de ${selectedClaims.length} 'claims' existants.`);
  await new Promise(resolve => setTimeout(resolve, 1500));

  console.log('MOCK_CLAIM_EXTRACTOR: ✅ Extraction simulée terminée !');

  return selectedClaims;
}


module.exports = { extractClaimsWithTimestamps, mockExtractClaimsFromText };