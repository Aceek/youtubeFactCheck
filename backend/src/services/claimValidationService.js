const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { extractJsonFromString } = require('../utils/jsonUtils'); // Import de la fonction utilitaire

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const promptPath = path.join(__dirname, '../prompts/claim_validation.prompt.txt');
const SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf-8');

async function validateClaim(claim, paragraphs) {
  const contextParagraph = paragraphs.find(p => claim.timestamp >= (p.start / 1000) && claim.timestamp <= (p.end / 1000));
  if (!contextParagraph) {
    return { validationStatus: 'HALLUCINATION', explanation: 'Contexte original introuvable pour ce timestamp.', validationScore: 1.0 };
  }

  const userPrompt = `Contexte Original: "${contextParagraph.text}"\n\nAffirmation Extraite: "${claim.text}"`;
  const model = process.env.VALIDATION_MODEL || "mistralai/mistral-7b-instruct:free";

  try {
    const response = await openrouter.chat.completions.create({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    });
    const rawJson = response.choices[0].message.content;
    const cleanedJson = extractJsonFromString(rawJson);
    if (!cleanedJson) {
        throw new Error("Impossible d'extraire un objet JSON de la réponse du LLM de validation.");
    }
    const result = JSON.parse(cleanedJson);
    return {
      validationStatus: result.validation_status,
      explanation: result.explanation,
      validationScore: result.confidence_score,
    };
  } catch (error) {
    console.error(`Erreur de validation pour le claim ID ${claim.id}:`, error.message);
    return { validationStatus: 'INACCURATE', explanation: 'Erreur lors du processus de validation.', validationScore: 0 };
  }
}

// --- NOUVELLE FONCTION DE VALIDATION MOCK ---
/**
 * Simule la validation d'un claim.
 * @returns {Promise<object>} Un résultat de validation simulé.
 */
async function mockValidateClaim(claim) {
  console.log(`MOCK_VALIDATOR: Validation simulée pour le claim ID ${claim.id}...`);
  await new Promise(resolve => setTimeout(resolve, 200)); // Simule un petit délai

  // On retourne un statut aléatoire pour tester l'UI
  const statuses = ['VALID', 'INACCURATE', 'OUT_OF_CONTEXT', 'HALLUCINATION'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const result = {
    validationStatus: randomStatus,
    explanation: `Ceci est une explication simulée pour un statut '${randomStatus}'.`,
    validationScore: Math.random() * (0.95 - 0.7) + 0.7, // Score aléatoire entre 0.7 et 0.95
  };

  console.log(`MOCK_VALIDATOR: ✅ Claim ID ${claim.id} validé avec le statut simulé : ${randomStatus}`);
  return result;
}

// On exporte la nouvelle fonction
module.exports = { validateClaim, mockValidateClaim };