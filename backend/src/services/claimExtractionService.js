const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const prisma = require('../client');
const debugLogService = require('./debugLogService');
const { extractJsonFromString } = require('../utils/jsonUtils');
const { chunkTranscript } = require('../utils/chunkUtils');

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const promptPath = path.join(__dirname, '../prompts/claim_extraction.prompt.txt');
const SYSTEM_PROMPT = fs.readFileSync(promptPath, 'utf-8');

/**
 * Extraction des claims par chunks avec orchestration de multiples appels LLM
 * @param {number} analysisId - L'ID de l'analyse (pour nommer les fichiers)
 * @param {object} structuredTranscript - La transcription structurée (content)
 * @param {string} model - Le nom du modèle LLM utilisé
 */
async function extractClaimsWithTimestamps(analysisId, structuredTranscript, model) {
  console.log(`🔄 Début de l'extraction par chunks avec le modèle: ${model}`);
  
  // 1. Vérifier que nous avons des paragraphes
  if (!structuredTranscript.paragraphs || !Array.isArray(structuredTranscript.paragraphs) || structuredTranscript.paragraphs.length === 0) {
    console.error("Aucun paragraphe trouvé dans la transcription structurée");
    return [];
  }

  // 2. Récupérer les paramètres de chunking depuis l'environnement
  const chunkSize = parseInt(process.env.CHUNK_SIZE) || 4;
  const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP) || 1;
  
  console.log(`📊 Configuration chunks: taille=${chunkSize}, chevauchement=${chunkOverlap}`);

  // 3. Découper la transcription en chunks
  const chunks = chunkTranscript(structuredTranscript.paragraphs, chunkSize, chunkOverlap);
  
  if (chunks.length === 0) {
    console.warn("Aucun chunk généré à partir de la transcription");
    return [];
  }

  console.log(`📦 ${chunks.length} chunks générés pour l'extraction`);

  // 4. Traiter les chunks par lots et collecter tous les claims
  const allClaims = [];
  const limit = parseInt(process.env.CONCURRENT_CHUNK_LIMIT) || 3;
  
  console.log(`🚀 Traitement par lots avec une limite de ${limit} chunks simultanés`);

  // Créer un tableau de tâches (une tâche par chunk)
  const tasks = chunks.map(chunk => async () => {
    console.log(`🔍 Traitement du chunk ${chunk.id} (${chunk.startTime}s - ${chunk.endTime}s)`);
    
    try {
      // Sauvegarder le prompt pour ce chunk
      const chunkSubfolder = `extraction/chunk_${chunk.id}`;
      debugLogService.log(
        analysisId,
        '1_prompt.txt',
        `--- PROMPT ENVOYÉ AU MODÈLE : ${model} ---\n--- CHUNK ${chunk.id} (${chunk.startTime}s - ${chunk.endTime}s) ---\n\n${chunk.text}`,
        chunkSubfolder
      );

      // Appel au LLM pour ce chunk
      const response = await openrouter.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: chunk.text }
        ],
        response_format: { type: "json_object" },
      });

      const rawJson = response.choices[0].message.content;
      
      // Sauvegarder la réponse brute
      debugLogService.log(
        analysisId,
        '2_response.txt',
        rawJson,
        chunkSubfolder
      );

      // Parser la réponse JSON
      const cleanedJson = extractJsonFromString(rawJson);
      if (!cleanedJson) {
        throw new Error("Aucun objet JSON valide n'a pu être extrait de la réponse du LLM.");
      }

      const parsedData = JSON.parse(cleanedJson);
      if (!parsedData.claims || !Array.isArray(parsedData.claims)) {
        console.warn(`Chunk ${chunk.id}: Aucun claim trouvé ou structure JSON invalide`);
        return [];
      }

      // Traiter les claims de ce chunk (sans raffinage, on fait confiance au LLM)
      const chunkClaims = parsedData.claims.map(claimData => {
        const { claim: claimText, estimated_timestamp } = claimData;
        
        // Validation basique du timestamp
        const timestamp = typeof estimated_timestamp === 'number' && estimated_timestamp >= 0
          ? estimated_timestamp
          : chunk.startTime; // Fallback au début du chunk si timestamp invalide

        return {
          text: claimText,
          timestamp: timestamp
        };
      });

      console.log(`✅ Chunk ${chunk.id}: ${chunkClaims.length} claims extraits`);
      return chunkClaims;

    } catch (error) {
      console.error(`❌ Erreur lors du traitement du chunk ${chunk.id}:`, error.message);
      
      // Sauvegarder l'erreur pour debug
      debugLogService.log(
        analysisId,
        '2_response_FAILED.txt',
        `ERREUR: ${error.message}`,
        `extraction/chunk_${chunk.id}`
      );
      
      // Retourner un tableau vide en cas d'erreur
      return [];
    }
  });

  // Traiter les tâches par lots
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    const batchNumber = Math.floor(i / limit) + 1;
    const totalBatches = Math.ceil(tasks.length / limit);
    
    console.log(`📦 Traitement du lot ${batchNumber}/${totalBatches} (${batch.length} chunks)`);
    
    try {
      const batchResults = await Promise.all(batch.map(task => task()));
      
      // Agréger les résultats de ce lot
      for (const chunkClaims of batchResults) {
        allClaims.push(...chunkClaims);
      }
      
      console.log(`✅ Lot ${batchNumber} terminé`);
      
    } catch (error) {
      console.error(`❌ Erreur lors du traitement du lot ${batchNumber}:`, error.message);
      // Continuer avec les autres lots même en cas d'erreur
    }
  }

  console.log(`📋 Total avant dédoublonnage: ${allClaims.length} claims`);

  // 5. Dédoublonnage des claims (à cause du chevauchement)
  const uniqueClaims = deduplicateClaims(allClaims, chunks, structuredTranscript.paragraphs);
  
  console.log(`✨ Total après dédoublonnage: ${uniqueClaims.length} claims uniques`);
  
  // 6. Sauvegarder un résumé de l'extraction
  const extractionSummary = {
    totalChunks: chunks.length,
    chunkSize: chunkSize,
    chunkOverlap: chunkOverlap,
    model: model,
    totalClaimsBeforeDedup: allClaims.length,
    totalClaimsAfterDedup: uniqueClaims.length,
    extractionTimestamp: new Date().toISOString(),
    chunks: chunks.map(chunk => ({
      id: chunk.id,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      claimsExtracted: allClaims.filter(claim => 
        claim.timestamp >= chunk.startTime && claim.timestamp <= chunk.endTime
      ).length
    }))
  };

  debugLogService.log(
    analysisId,
    'extraction_summary.json',
    JSON.stringify(extractionSummary, null, 2),
    'extraction'
  );

  return uniqueClaims;
}

/**
 * Filtre les claims pour supprimer les doublons générés par le chevauchement des chunks.
 * La stratégie consiste à ignorer les claims trouvés dans la zone de chevauchement
 * de chaque chunk, sauf pour le tout premier chunk.
 * @param {Array} allClaims - Liste de tous les claims extraits de tous les chunks.
 * @param {Array} chunks - La liste des chunks générés par chunkTranscript.
 * @param {Array} paragraphs - La liste des paragraphes originaux d'AssemblyAI.
 * @returns {Array} Claims uniques après filtrage.
 */
function deduplicateClaims(allClaims, chunks, paragraphs) {
  if (chunks.length <= 1) {
    return allClaims; // Pas de chevauchement s'il n'y a qu'un chunk ou moins.
  }

  const chunkOverlapSize = parseInt(process.env.CHUNK_OVERLAP) || 1;
  const uniqueClaims = [];
  const duplicatesRemoved = { count: 0 }; // Utiliser un objet pour passer par référence

  // Trier les claims par timestamp pour un traitement ordonné.
  const sortedClaims = allClaims.sort((a, b) => a.timestamp - b.timestamp);

  for (const claim of sortedClaims) {
    // Trouver à quel chunk ce claim appartient.
    const parentChunk = chunks.find(chunk => claim.timestamp >= chunk.startTime && claim.timestamp <= chunk.endTime);
    
    if (!parentChunk) {
      // Cas peu probable, mais on le garde par sécurité.
      uniqueClaims.push(claim);
      continue;
    }

    // Le premier chunk (id: 0) est notre source de vérité, on garde tout.
    if (parentChunk.id === 0) {
      uniqueClaims.push(claim);
      continue;
    }

    // Pour les chunks suivants, on détermine la "vraie" date de début (après l'overlap).
    const firstNonOverlapParagraphIndex = parentChunk.paragraphIndices.start + chunkOverlapSize;

    // Si l'index est valide dans la liste des paragraphes...
    if (firstNonOverlapParagraphIndex < paragraphs.length) {
      const trueStartTime = Math.round(paragraphs[firstNonOverlapParagraphIndex].start / 1000);

      // On ne garde le claim que s'il est dans la partie "nouvelle" du chunk.
      if (claim.timestamp >= trueStartTime) {
        uniqueClaims.push(claim);
      } else {
        // Ce claim est dans la zone de chevauchement, on le considère comme un doublon.
        duplicatesRemoved.count++;
      }
    } else {
      // Ce chunk est entièrement composé de paragraphes de chevauchement (cas final), on ne garde rien.
      duplicatesRemoved.count++;
    }
  }

  if (duplicatesRemoved.count > 0) {
    console.log(`🔄 ${duplicatesRemoved.count} doublons potentiels supprimés grâce au filtrage par chevauchement.`);
  }

  return uniqueClaims;
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