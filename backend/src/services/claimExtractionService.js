const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const prisma = require('../client');
const debugLogService = require('./debugLogService'); // <-- NOUVEL IMPORT
const stringSimilarity = require('string-similarity');
const { extractJsonFromString } = require('../utils/jsonUtils'); // Import de la fonction utilitaire

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

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
    // 1. Préparer et sauvegarder le prompt
    const taggedText = createTaggedTranscript(structuredTranscript);
    if (!taggedText) {
        console.error("Transcription balisée vide. Impossible de procéder.");
        return [];
    }

    // --- UTILISATION DU SERVICE DE LOG ---
    debugLogService.log(
      analysisId,
      '1_extraction_prompt.txt',
      `--- PROMPT ENVOYÉ AU MODÈLE : ${model} ---\n\n${taggedText}`
    );

    // 2. Appeler le LLM et sauvegarder la réponse BRUTE
    let rawJson = null;
    let responseSuccess = false;
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
        responseSuccess = true; // On marque la réponse comme réussie ici

        // 3. Tenter de parser le JSON (c'est ici que l'erreur se produit)
        const cleanedJson = extractJsonFromString(rawJson);

        if (!cleanedJson) {
            throw new Error("Aucun objet JSON valide n'a pu être extrait de la réponse du LLM.");
        }

        const parsedData = JSON.parse(cleanedJson);
        if (!parsedData.claims || !Array.isArray(parsedData.claims)) {
            throw new Error("Le JSON parsé n'a pas la structure attendue.");
        }

        console.log(`${parsedData.claims.length} affirmations brutes extraites. Raffinage des timestamps...`);

        // --- NOUVELLE LOGIQUE DE RAFFINAGE PLUS ROBUSTE ---
        const claimsWithTimestamps = parsedData.claims.map(claimData => {
            const { claim: claimText, estimated_timestamp } = claimData;
            if (typeof estimated_timestamp !== 'number') {
                return { text: claimText, timestamp: 0 };
            }

            const searchWindowStart = Math.max(0, estimated_timestamp - 10);
            const searchWindowEnd = estimated_timestamp + 10;
            
            const wordsArray = structuredTranscript.words || structuredTranscript;

            const windowWords = wordsArray.filter(word => {
                const wordTime = word.start / 1000;
                return wordTime >= searchWindowStart && wordTime <= searchWindowEnd;
            });

            if (windowWords.length === 0) {
                console.warn(`⚠️ Fenêtre de recherche vide pour le timestamp ${estimated_timestamp}. Utilisation du timestamp estimé.`);
                return { text: claimText, timestamp: estimated_timestamp };
            }
            
            const claimWords = normalizeText(claimText).split(' ');
            const windowText = windowWords.map(w => normalizeText(w.text)).join(' ');

            let bestMatch = { score: 0, timestamp: estimated_timestamp };

            for (let i = 0; i < claimWords.length; i++) {
                for (let j = i + 1; j <= claimWords.length; j++) {
                    const subSequence = claimWords.slice(i, j).join(' ');
                    if (subSequence.length < 5) continue;

                    if (windowText.includes(subSequence)) {
                        const score = subSequence.length / claimText.length;
                        if (score > bestMatch.score) {
                            bestMatch.score = score;
                            bestMatch.timestamp = Math.round(windowWords[0].start / 1000);
                        }
                    }
                }
            }
            
            const CONFIDENCE_THRESHOLD = 0.5;
            if (bestMatch.score >= CONFIDENCE_THRESHOLD) {
                console.log(`✅ Raffinage partiel réussi pour "${claimText.substring(0,20)}..." (Score: ${bestMatch.score.toFixed(2)})`);
                return { text: claimText, timestamp: bestMatch.timestamp };
            }
            
            console.warn(`⚠️ Échec du raffinage pour "${claimText.substring(0,20)}...". Utilisation du timestamp estimé.`);
            return { text: claimText, timestamp: estimated_timestamp };
        });

        return claimsWithTimestamps;

    } catch (e) {
        console.error("Erreur de parsing ou d'appel LLM:", e.message);
        // On propage l'erreur pour que le service appelant (videoService) puisse la gérer
        throw e;
    } finally {
        // Ce bloc s'exécute toujours, succès ou échec du try.
        if (rawJson) {
            const fileName = responseSuccess
                ? '2_extraction_response.txt'
                : '2_extraction_response_FAILED.txt';
            debugLogService.log(analysisId, fileName, rawJson);
        }
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