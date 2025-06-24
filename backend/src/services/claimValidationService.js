const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { extractJsonFromString } = require('../utils/jsonUtils');

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const chunkPromptPath = path.join(__dirname, '../prompts/claim_validation_chunk.prompt.txt');
const CHUNK_SYSTEM_PROMPT = fs.readFileSync(chunkPromptPath, 'utf-8');

/**
 * Fonction utilitaire pour effectuer un appel LLM avec système de retry
 * @param {Function} apiCall - Fonction qui effectue l'appel API
 * @param {number} maxRetries - Nombre maximum de tentatives
 * @param {number} delayMs - Délai entre les tentatives en millisecondes
 * @param {string} context - Contexte pour les logs
 * @returns {Promise} Résultat de l'appel API
 */
async function callLLMWithRetry(apiCall, maxRetries, delayMs, context) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      if (attempt > 1) {
        console.log(`✅ ${context}: Succès à la tentative ${attempt}/${maxRetries}`);
      }
      return result;
    } catch (error) {
      console.error(`❌ ${context}: Erreur à la tentative ${attempt}/${maxRetries}: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.error(`💥 ${context}: Échec définitif après ${maxRetries} tentatives`);
        throw error;
      }
      
      console.log(`⏳ ${context}: Attente de ${delayMs}ms avant la tentative ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Valide un ensemble de claims dans le contexte d'un chunk avec système de retry
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

  // Récupérer les paramètres de retry
  const maxRetries = parseInt(process.env.LLM_RETRY_COUNT) || 3;
  const retryDelay = parseInt(process.env.LLM_RETRY_DELAY_MS) || 2000;
  
  console.log(`🔄 Validation avec retry: ${maxRetries} tentatives max, délai ${retryDelay}ms`);

  // Définir la fonction d'appel API pour le retry
  const apiCall = async () => {
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
  };

  try {
    // Appel avec système de retry
    return await callLLMWithRetry(
      apiCall,
      maxRetries,
      retryDelay,
      `Validation chunk (${claimsInChunk.length} claims)`
    );
  } catch (error) {
    console.error(`💥 Échec définitif de la validation après ${maxRetries} tentatives:`, error.message);
    
    // Retourner des résultats d'erreur pour tous les claims du chunk
    const errorResults = claimsInChunk.map(claim => ({
      claimId: claim.id,
      validationStatus: 'INACCURATE',
      explanation: `Erreur définitive après ${maxRetries} tentatives: ${error.message}`,
      validationScore: 0
    }));

    return errorResults;
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
  mockValidateClaim 
};