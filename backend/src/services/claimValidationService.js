const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { extractJsonFromString } = require('../utils/jsonUtils');

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const promptPath = path.join(__dirname, '../prompts/claim_validation.prompt.txt');
const chunkPromptPath = path.join(__dirname, '../prompts/claim_validation_chunk.prompt.txt');
const SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf-8');
const CHUNK_SYSTEM_PROMPT = fs.readFileSync(chunkPromptPath, 'utf-8');

/**
 * Valide un ensemble de claims dans le contexte d'un chunk
 * @param {Array} claimsInChunk - Liste des claims à valider dans ce chunk
 * @param {string} contextText - Le texte du chunk de paragraphes correspondant
 * @param {string} model - Le modèle LLM à utiliser pour la validation
 * @returns {Promise<Array>} Liste des résultats de validation
 */
async function validateClaimsChunk(claimsInChunk, contextText, model) {
  if (!claimsInChunk || claimsInChunk.length === 0) {
    console.warn('validateClaimsChunk: Aucun claim à valider dans ce chunk');
    return [];
  }

  console.log(`🔍 Validation de ${claimsInChunk.length} claims dans un chunk`);

  // Préparer les claims pour le prompt
  const claimsForPrompt = claimsInChunk.map((claim, index) => ({
    id: `claim_${index}`,
    text: claim.text,
    originalId: claim.id // Garder l'ID original pour le mapping
  }));

  // Construire le prompt utilisateur
  const userPrompt = `Contexte Original: "${contextText}"

Affirmations à valider: ${JSON.stringify(claimsForPrompt.map(c => ({ id: c.id, text: c.text })), null, 2)}`;

  try {
    const response = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: "system", content: CHUNK_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      timeout: 45000,
    });

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error("La réponse de l'API de validation est vide ou malformée.");
    }

    const rawJson = response.choices[0].message.content;
    const cleanedJson = extractJsonFromString(rawJson);
    
    if (!cleanedJson) {
      throw new Error("Impossible d'extraire un objet JSON de la réponse du LLM de validation.");
    }

    const result = JSON.parse(cleanedJson);
    
    if (!result.validations || !Array.isArray(result.validations)) {
      throw new Error("La réponse JSON n'a pas la structure attendue (manque 'validations').");
    }

    // Mapper les résultats aux claims originaux
    const validationResults = [];
    
    for (const claimForPrompt of claimsForPrompt) {
      const validationResult = result.validations.find(v => v.id === claimForPrompt.id);
      
      if (validationResult) {
        validationResults.push({
          claimId: claimForPrompt.originalId,
          validationStatus: validationResult.validation_status || 'INACCURATE',
          explanation: validationResult.explanation || 'Réponse JSON invalide du modèle.',
          validationScore: validationResult.confidence_score || 0,
        });
      } else {
        // Fallback si le LLM n'a pas retourné de validation pour ce claim
        console.warn(`Aucune validation trouvée pour le claim ${claimForPrompt.id}`);
        validationResults.push({
          claimId: claimForPrompt.originalId,
          validationStatus: 'INACCURATE',
          explanation: 'Aucune validation retournée par le modèle pour ce claim.',
          validationScore: 0,
        });
      }
    }

    console.log(`✅ ${validationResults.length} validations traitées avec succès`);
    return validationResults;

  } catch (error) {
    console.error(`❌ Erreur de validation pour le chunk:`, error.message);
    
    // Retourner des résultats d'erreur pour tous les claims du chunk
    const errorResults = claimsInChunk.map(claim => ({
      claimId: claim.id,
      validationStatus: 'INACCURATE',
      explanation: `Erreur lors du processus de validation: ${error.message}`,
      validationScore: 0
    }));

    return errorResults;
  }
}

/**
 * ANCIENNE FONCTION - Maintenue pour compatibilité mais dépréciée
 * @deprecated Utiliser validateClaimsChunk à la place
 */
async function validateClaim(claim, paragraphs) {
  console.warn('validateClaim est déprécié. Utilisez validateClaimsChunk à la place.');
  
  let bestMatchIndex = -1;

  // 1. Trouver l'index du paragraphe contenant le timestamp.
  // On cherche le dernier paragraphe dont le début est ANTERIEUR ou EGAL au timestamp du claim.
  // C'est robuste et gère le cas `timestamp: 0`.
  for (let i = 0; i < paragraphs.length; i++) {
    const paraStartSeconds = paragraphs[i].start / 1000;
    if (paraStartSeconds <= claim.timestamp) {
      bestMatchIndex = i;
    } else {
      // Les paragraphes sont triés, on peut donc s'arrêter dès qu'on dépasse le temps.
      break;
    }
  }

  let usedContext;

  if (bestMatchIndex !== -1) {
    // 2. Construire la "fenêtre de contexte" de 3 paragraphes
    const contextSlices = [];
    
    // Paragraphe précédent
    if (bestMatchIndex > 0) {
      contextSlices.push(paragraphs[bestMatchIndex - 1].text);
    }
    // Paragraphe principal
    contextSlices.push(paragraphs[bestMatchIndex].text);
    // Paragraphe suivant
    if (bestMatchIndex < paragraphs.length - 1) {
      contextSlices.push(paragraphs[bestMatchIndex + 1].text);
    }

    usedContext = contextSlices.join('\n\n---\n\n');
  } else {
    usedContext = 'Contexte introuvable (le timestamp du claim est invalide ou précède la transcription).';
    const validationResult = { 
      validationStatus: 'HALLUCINATION', 
      explanation: 'Le timestamp du claim ne correspond à aucun paragraphe de la transcription.', 
      validationScore: 1.0 
    };
    return { validationResult, usedContext };
  }

  const userPrompt = `Contexte Original: "${usedContext}"\n\nAffirmation Extraite: "${claim.text}"`;
  const model = process.env.VALIDATION_MODEL || "mistralai/mistral-7b-instruct:free";

  try {
    const response = await openrouter.chat.completions.create({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
      timeout: 45000,
    });

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error("La réponse de l'API de validation est vide ou malformée.");
    }

    const rawJson = response.choices[0].message.content;
    const cleanedJson = extractJsonFromString(rawJson);
    if (!cleanedJson) {
      throw new Error("Impossible d'extraire un objet JSON de la réponse du LLM de validation.");
    }
    const result = JSON.parse(cleanedJson);
    
    const validationResult = {
      validationStatus: result.validation_status || 'INACCURATE',
      explanation: result.explanation || 'Réponse JSON invalide du modèle.',
      validationScore: result.confidence_score || 0,
    };
    return { validationResult, usedContext };

  } catch (error) {
    console.error(`Erreur de validation pour le claim ID ${claim.id}:`, error.message);
    const validationResult = { 
      validationStatus: 'INACCURATE', 
      explanation: `Erreur lors du processus de validation: ${error.message}`, 
      validationScore: 0 
    };
    return { validationResult, usedContext };
  }
}

async function mockValidateClaim(claim) {
  console.log(`MOCK_VALIDATOR: Validation simulée pour le claim ID ${claim.id}...`);
  await new Promise(resolve => setTimeout(resolve, 200));

  const statuses = ['VALID', 'INACCURATE', 'OUT_OF_CONTEXT', 'HALLUCINATION'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const validationResult = {
    validationStatus: randomStatus,
    explanation: `Ceci est une explication simulée pour un statut '${randomStatus}'.`,
    validationScore: Math.random() * (0.95 - 0.7) + 0.7,
  };
  const usedContext = "Ceci est un contexte simulé pour le mode MOCK.";

  console.log(`MOCK_VALIDATOR: ✅ Claim ID ${claim.id} validé avec le statut simulé : ${randomStatus}`);
  return { validationResult, usedContext };
}

module.exports = { 
  validateClaimsChunk, 
  validateClaim, // Maintenu pour compatibilité
  mockValidateClaim 
};