const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const prisma = require('../client');
const debugLogService = require('./debugLogService');
const webSearchService = require('./webSearchService');
const googleFactCheckService = require('./googleFactCheckService');
const { extractJsonFromString } = require('../utils/jsonUtils');

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const factCheckPromptPath = path.join(__dirname, '../prompts/fact_check_verdict.prompt.txt');
const FACT_CHECK_PROMPT = fs.readFileSync(factCheckPromptPath, 'utf-8');

const searchQueriesPromptPath = path.join(__dirname, '../prompts/generate_search_queries.prompt.txt');
const SEARCH_QUERIES_PROMPT = fs.readFileSync(searchQueriesPromptPath, 'utf-8');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * Génère des requêtes de recherche optimisées par lots avec journalisation détaillée
 * @param {Array} claims - Liste des claims à traiter
 * @param {number} analysisId - ID de l'analyse pour les logs
 * @returns {Promise<Object>} Mapping claimId -> [requêtes de recherche]
 */
async function generateSearchQueries(claims, analysisId = null) {
  if (!claims || claims.length === 0) {
    return {};
  }

  console.log(`🔍 Génération de requêtes de recherche pour ${claims.length} claims`);

  const batchSize = parseInt(process.env.SEARCH_QUERY_BATCH_SIZE) || 5;
  const maxRetries = parseInt(process.env.LLM_RETRY_COUNT) || 3;
  const retryDelay = parseInt(process.env.LLM_RETRY_DELAY_MS) || 2000;
  const model = process.env.SEARCH_QUERY_MODEL || "mistralai/mistral-7b-instruct:free";
  const limit = parseInt(process.env.CONCURRENT_CHUNK_LIMIT) || 3;

  // Découper les claims en lots
  const batches = [];
  for (let i = 0; i < claims.length; i += batchSize) {
    batches.push(claims.slice(i, i + batchSize));
  }

  console.log(`📦 ${batches.length} lots générés pour la génération de requêtes (taille: ${batchSize})`);
  console.log(`🚀 Traitement par lots : limite=${limit}, retries=${maxRetries}`);

  // Créer les tâches de traitement par lots
  const tasks = batches.map((batch, batchIndex) => async () => {
    const batchNumber = batchIndex + 1;
    console.log(`🔍 Traitement du lot ${batchNumber}/${batches.length} (${batch.length} claims)`);
    
    const batchSubfolder = analysisId ? `query_generation/batch_${batchNumber}` : null;
    
    // Préparer les claims pour le prompt
    const claimsForPrompt = batch.map(claim => ({
      claim_id: claim.id,
      text: claim.text
    }));

    const userPrompt = `Affirmations à traiter : ${JSON.stringify(claimsForPrompt, null, 2)}`;

    // Sauvegarder le prompt pour ce lot
    if (analysisId && batchSubfolder) {
      debugLogService.log(
        analysisId,
        '1_prompt.txt',
        `--- PROMPT ENVOYÉ AU MODÈLE : ${model} ---\n--- LOT ${batchNumber} (${batch.length} claims) ---\n\n${SEARCH_QUERIES_PROMPT}\n\n${userPrompt}`,
        batchSubfolder
      );
    }

    try {
      const apiCall = async () => {
        const response = await openrouter.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: "Tu es un expert en génération de requêtes de recherche pour le fact-checking." },
            { role: "user", content: `${SEARCH_QUERIES_PROMPT}\n\n${userPrompt}` }
          ],
          response_format: { type: "json_object" },
          timeout: 30000,
        });

        if (!response.choices || response.choices.length === 0) {
          throw new Error("Réponse vide de l'API pour la génération de requêtes");
        }

        const rawJson = response.choices[0].message.content;
        
        // Sauvegarder la réponse brute
        if (analysisId && batchSubfolder) {
          debugLogService.log(
            analysisId,
            '2_response.txt',
            rawJson,
            batchSubfolder
          );
        }

        const cleanedJson = extractJsonFromString(rawJson);
        
        if (!cleanedJson) {
          throw new Error("Impossible d'extraire un JSON valide de la réponse");
        }

        const result = JSON.parse(cleanedJson);
        
        if (!result.queries || !Array.isArray(result.queries)) {
          throw new Error("Structure JSON invalide pour les requêtes");
        }

        return result.queries;
      };

      const queries = await callLLMWithRetry(
        apiCall,
        maxRetries,
        retryDelay,
        `Génération requêtes lot ${batchNumber}`
      );

      console.log(`✅ Lot ${batchNumber} traité avec succès: ${queries.length} résultats`);
      return { batchNumber, queries, success: true };

    } catch (error) {
      console.error(`❌ Erreur lors du traitement du lot ${batchNumber}:`, error.message);
      
      // Sauvegarder l'erreur
      if (analysisId && batchSubfolder) {
        debugLogService.log(
          analysisId,
          '2_response_FAILED.txt',
          `Erreur: ${error.message}`,
          batchSubfolder
        );
      }

      return { batchNumber, queries: [], success: false, error: error.message };
    }
  });

  // Exécuter les tâches par lots avec concurrence contrôlée
  let processedBatches = 0;
  const allResults = [];

  for (let i = 0; i < tasks.length; i += limit) {
    const batchTasks = tasks.slice(i, i + limit);
    const batchResults = await Promise.all(batchTasks.map(task => task()));
    allResults.push(...batchResults);
    
    processedBatches += batchTasks.length;
    console.log(`📊 Progrès génération requêtes: ${processedBatches}/${tasks.length} lots traités`);
    
    // Pause entre les groupes de lots
    if (i + limit < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Construire le mapping final
  const queryMapping = {};
  let totalQueriesGenerated = 0;
  let successfulBatches = 0;

  for (const result of allResults) {
    if (result.success) {
      successfulBatches++;
      for (const queryData of result.queries) {
        if (queryData.claim_id && queryData.searches) {
          queryMapping[queryData.claim_id] = queryData.searches;
          totalQueriesGenerated += queryData.searches.length;
        }
      }
    }
  }

  // Fallback pour les claims sans requêtes générées
  let fallbackCount = 0;
  for (const claim of claims) {
    if (!queryMapping[claim.id]) {
      const basicQueries = [
        claim.text.substring(0, 50),
        `"${claim.text.split(' ').slice(0, 5).join(' ')}"`,
        claim.text.split(' ').slice(0, 3).join(' ') + ' vérification'
      ];
      queryMapping[claim.id] = basicQueries;
      fallbackCount++;
    }
  }

  // Créer un rapport de synthèse
  const summary = {
    totalClaims: claims.length,
    totalBatches: batches.length,
    successfulBatches: successfulBatches,
    failedBatches: batches.length - successfulBatches,
    totalQueriesGenerated: totalQueriesGenerated,
    fallbackQueriesUsed: fallbackCount,
    model: model,
    batchSize: batchSize,
    timestamp: new Date().toISOString()
  };

  // Sauvegarder le rapport de synthèse
  if (analysisId) {
    debugLogService.log(
      analysisId,
      '_summary.json',
      JSON.stringify(summary, null, 2),
      'query_generation'
    );
  }

  console.log(`✅ Génération de requêtes terminée: ${Object.keys(queryMapping).length} claims traités`);
  console.log(`📊 Synthèse: ${successfulBatches}/${batches.length} lots réussis, ${fallbackCount} fallbacks utilisés`);

  return queryMapping;
}

/**
 * Vérifie un claim unique via le pipeline complet de fact-checking
 * @param {Object} claim - Le claim à vérifier
 * @param {Array} searchQueries - Les requêtes de recherche pour ce claim
 * @param {number} analysisId - ID de l'analyse pour les logs
 * @returns {Promise<Object>} Résultat du fact-checking
 */
async function verifySingleClaim(claim, searchQueries, analysisId) {
  console.log(`🔍 Fact-checking du claim ${claim.id}: "${claim.text.substring(0, 100)}..."`);
  
  const claimSubfolder = `fact_checking/claim_${claim.id}`;
  
  // Sauvegarder les requêtes générées
  debugLogService.log(
    analysisId,
    '1_search_queries.json',
    JSON.stringify({ claimId: claim.id, claimText: claim.text, searchQueries }, null, 2),
    claimSubfolder
  );

  try {
    // ÉTAPE 1: Priorité à Google Fact Check
    console.log(`🔍 Étape 1: Recherche Google Fact Check pour claim ${claim.id}`);
    const googleResult = await googleFactCheckService.query(claim.text);
    
    if (googleResult) {
      console.log(`✅ Google Fact Check trouvé pour claim ${claim.id}: ${googleResult.verdict}`);
      
      // Formater le résultat Google
      const result = {
        factCheckStatus: 'COMPLETED',
        verdict: googleResult.verdict,
        verdictReason: `Fact-check existant par ${googleResult.sourceName}: ${googleResult.originalRating}`,
        sources: [
          {
            url: googleResult.sourceUrl,
            title: `${googleResult.sourceName} - Fact Check`
          }
        ]
      };

      // Sauvegarder le résultat Google
      debugLogService.log(
        analysisId,
        '2_google_result.json',
        JSON.stringify({ googleResult, finalResult: result }, null, 2),
        claimSubfolder
      );

      return result;
    }

    console.log(`ℹ️ Aucun fact-check Google trouvé pour claim ${claim.id}, passage à la recherche web`);

    // ÉTAPE 2: Recherche web via Serper
    console.log(`🔍 Étape 2: Recherche web pour claim ${claim.id}`);
    const searchResults = await webSearchService.searchMultiple(searchQueries);
    
    if (!searchResults || searchResults.length === 0) {
      console.warn(`⚠️ Aucun résultat de recherche pour claim ${claim.id}`);
      
      const result = {
        factCheckStatus: 'COMPLETED',
        verdict: 'UNVERIFIABLE',
        verdictReason: 'Aucune source trouvée pour vérifier cette affirmation.',
        sources: []
      };

      debugLogService.log(
        analysisId,
        '3_no_search_results.json',
        JSON.stringify({ searchQueries, finalResult: result }, null, 2),
        claimSubfolder
      );

      return result;
    }

    console.log(`✅ ${searchResults.length} résultats de recherche trouvés pour claim ${claim.id}`);

    // Sauvegarder les résultats de recherche
    debugLogService.log(
      analysisId,
      '2_search_results.json',
      JSON.stringify({ searchQueries, searchResults }, null, 2),
      claimSubfolder
    );

    // ÉTAPE 3: Construire le corpus de preuves
    const evidenceCorpus = searchResults.map(result => 
      `Source: ${result.title}\nURL: ${result.link}\nContenu: ${result.snippet}`
    ).join('\n\n---\n\n');

    // ÉTAPE 4: Verdict du LLM Juge
    console.log(`🤖 Étape 3: Analyse LLM pour claim ${claim.id}`);
    const userPrompt = `Affirmation à vérifier: "${claim.text}"

Corpus de Preuves:
${evidenceCorpus}`;

    const factCheckModel = process.env.FACT_CHECK_MODEL || "openai/gpt-4o";
    const maxRetries = parseInt(process.env.LLM_RETRY_COUNT) || 3;
    const retryDelay = parseInt(process.env.LLM_RETRY_DELAY_MS) || 2000;

    const apiCall = async () => {
      const response = await openrouter.chat.completions.create({
        model: factCheckModel,
        messages: [
          { role: "system", content: FACT_CHECK_PROMPT },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        timeout: 45000,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error("Réponse vide de l'API de fact-checking");
      }

      const rawJson = response.choices[0].message.content;
      
      // Sauvegarder la réponse brute
      debugLogService.log(
        analysisId,
        '3_llm_response.txt',
        rawJson,
        claimSubfolder
      );

      const cleanedJson = extractJsonFromString(rawJson);
      
      if (!cleanedJson) {
        throw new Error("Impossible d'extraire un JSON valide de la réponse LLM");
      }

      const llmResult = JSON.parse(cleanedJson);
      
      if (!llmResult.verdict || !llmResult.explanation) {
        throw new Error("Structure JSON invalide dans la réponse LLM");
      }

      return llmResult;
    };

    const llmResult = await callLLMWithRetry(
      apiCall,
      maxRetries,
      retryDelay,
      `Fact-check LLM claim ${claim.id}`
    );

    // Formater le résultat final
    const result = {
      factCheckStatus: 'COMPLETED',
      verdict: llmResult.verdict,
      verdictReason: llmResult.explanation,
      sources: llmResult.sources || []
    };

    console.log(`✅ Fact-checking terminé pour claim ${claim.id}: ${result.verdict}`);

    // Sauvegarder le résultat final
    debugLogService.log(
      analysisId,
      '4_final_result.json',
      JSON.stringify({ llmResult, finalResult: result }, null, 2),
      claimSubfolder
    );

    return result;

  } catch (error) {
    console.error(`❌ Erreur lors du fact-checking du claim ${claim.id}:`, error.message);
    
    const errorResult = {
      factCheckStatus: 'FAILED',
      verdict: 'UNVERIFIABLE',
      verdictReason: `Erreur lors de la vérification: ${error.message}`,
      sources: []
    };

    // Sauvegarder l'erreur
    debugLogService.log(
      analysisId,
      '4_error.json',
      JSON.stringify({ error: error.message, finalResult: errorResult }, null, 2),
      claimSubfolder
    );

    return errorResult;
  }
}

/**
 * Fonction principale pour orchestrer le fact-checking d'une analyse complète
 * @param {number} analysisId - ID de l'analyse
 * @param {Array} claimsToFactCheck - Liste des claims à vérifier
 */
async function runFactCheckingForAnalysis(analysisId, claimsToFactCheck) {
  console.log(`🚀 Début du fact-checking pour ${claimsToFactCheck.length} claims de l'analyse ${analysisId}`);
  
  // Mettre à jour le statut de l'analyse
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      status: 'FACT_CHECKING',
      progress: 0
    }
  });

  try {
    // ÉTAPE 1: Génération des requêtes de recherche en lot
    console.log(`📝 Génération des requêtes de recherche pour ${claimsToFactCheck.length} claims`);
    const searchQueriesMapping = await generateSearchQueries(claimsToFactCheck, analysisId);

    // ÉTAPE 2: Création des tâches de fact-checking
    const tasks = claimsToFactCheck.map(claim => async () => {
      const searchQueries = searchQueriesMapping[claim.id] || [];
      return await verifySingleClaim(claim, searchQueries, analysisId);
    });

    // ÉTAPE 3: Exécution par lots
    const limit = parseInt(process.env.CONCURRENT_CHUNK_LIMIT) || 3;
    let processedClaims = 0;
    const allResults = [];

    console.log(`🚀 Fact-checking par lots avec une limite de ${limit} claims simultanés`);

    for (let i = 0; i < tasks.length; i += limit) {
      const batch = tasks.slice(i, i + limit);
      const batchNumber = Math.floor(i / limit) + 1;
      const totalBatches = Math.ceil(tasks.length / limit);
      
      console.log(`📦 Fact-checking du lot ${batchNumber}/${totalBatches} (${batch.length} claims)`);
      
      try {
        const batchResults = await Promise.all(batch.map(task => task()));
        allResults.push(...batchResults);
        
        processedClaims += batch.length;
        
        // Sauvegarder les résultats de ce lot en base
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const claim = claimsToFactCheck[i + j];
          
          await prisma.claim.update({
            where: { id: claim.id },
            data: {
              factCheckStatus: result.factCheckStatus,
              verdict: result.verdict,
              verdictReason: result.verdictReason,
              sources: result.sources
            }
          });
        }
        
        // Calculer et mettre à jour le progrès
        const progress = Math.round((processedClaims / tasks.length) * 100);
        
        await prisma.analysis.update({
          where: { id: analysisId },
          data: {
            status: processedClaims < tasks.length ? 'PARTIALLY_COMPLETE' : 'FACT_CHECKING',
            progress: progress
          }
        });
        
        console.log(`✅ Lot de fact-checking ${batchNumber} terminé - Progrès: ${processedClaims}/${tasks.length} claims (${progress}%)`);
        
        // Pause entre les lots pour ménager les APIs
        if (i + limit < tasks.length) {
          await sleep(2000);
        }
        
      } catch (error) {
        console.error(`❌ Erreur lors du traitement du lot de fact-checking ${batchNumber}:`, error.message);
        processedClaims += batch.length;
      }
    }

    // Créer un rapport global de fact-checking
    const globalReport = {
      totalClaims: claimsToFactCheck.length,
      factCheckModel: process.env.FACT_CHECK_MODEL || "openai/gpt-4o",
      factCheckTimestamp: new Date().toISOString(),
      results: allResults.map((result, index) => {
        const claim = claimsToFactCheck[index];
        return {
          claimId: claim.id,
          claimText: claim.text,
          claimTimestamp: claim.timestamp,
          factCheckResult: result
        };
      })
    };

    debugLogService.log(
      analysisId,
      '4_fact_check_report.json',
      JSON.stringify(globalReport, null, 2)
    );

    console.log(`✅ Fact-checking terminé: ${allResults.length} claims traités`);

  } catch (error) {
    console.error(`❌ Erreur critique lors du fact-checking de l'analyse ${analysisId}:`, error.message);
    
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'FAILED',
        errorMessage: `Erreur de fact-checking: ${error.message}`,
        progress: 0
      }
    });
  }
}

module.exports = {
  runFactCheckingForAnalysis,
  verifySingleClaim,
  generateSearchQueries
};