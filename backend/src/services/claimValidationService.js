const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
// Idéalement, à déplacer dans un fichier utils/jsonUtils.js et importer
function extractJsonFromString(str) {
    if (!str || typeof str !== 'string') return null;
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;
    return str.substring(firstBrace, lastBrace + 1);
}

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

module.exports = { validateClaim };