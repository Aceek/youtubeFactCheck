const { PrismaClient } = require("@prisma/client");
const claimExtractionService = require("./claimExtractionService");
const { validateClaimsChunk, mockValidateClaim } = require("./claimValidationService");
const factCheckingService = require("./factCheckingService");
const { chunkTranscript, getClaimsForChunk } = require("../utils/chunkUtils");
const debugLogService = require('./debugLogService');
const metadataService = require('./metadataService');
const transcriptionService = require('./transcriptionService');
const reportService = require('./reportService');

const prisma = require("../client");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


async function getAnalysisById(id) {
  return prisma.analysis.findUnique({
    where: { id },
    include: {
      transcription: true,
      claims: { orderBy: { timestamp: 'asc' } },
      video: true,
    },
  });
}

async function startAnalysis(youtubeUrl, transcriptionProvider, withValidation, withFactChecking = false) {
  console.log(`Début de l'analyse pour l'URL: ${youtubeUrl} avec le fournisseur: ${transcriptionProvider}, validation: ${withValidation}, fact-checking: ${withFactChecking}`);
  const videoId = transcriptionService.extractVideoId(youtubeUrl);
  if (!videoId) throw new Error('URL YouTube invalide.');

  const currentLlmModel = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";

  if (transcriptionProvider === 'MOCK_PROVIDER') {
    console.log('MOCK_PROVIDER sélectionné. Lancement d\'un processus complet simulé.');
    const video = await prisma.video.upsert({
      where: { id: videoId },
      update: {},
      create: { id: videoId, youtubeUrl },
    });
    const analysis = await prisma.analysis.create({
      data: { videoId: video.id, status: 'PENDING' },
    });
    runFullProcess(analysis.id, youtubeUrl, transcriptionProvider, withValidation, withFactChecking);
    const initialAnalysisWithVideo = { ...analysis, video: video };
    return { analysis: initialAnalysisWithVideo, fromCache: false };
  } else {
    const lastAnalysis = await prisma.analysis.findFirst({
      where: { videoId: videoId, status: 'COMPLETE', llmModel: { not: 'MOCK_PROVIDER' } },
      orderBy: { createdAt: 'desc' },
      include: {
        transcription: true,
        claims: { orderBy: { timestamp: 'asc' } },
        video: true
      },
    });

    if (lastAnalysis) {
      if (lastAnalysis.llmModel === currentLlmModel) {
        console.log(`Cache HIT: Analyse réelle complète trouvée (ID: ${lastAnalysis.id}).`);
        return { analysis: lastAnalysis, fromCache: true };
      }
      console.log(`RE-ANALYSE: Le modèle LLM a changé de "${lastAnalysis.llmModel}" à "${currentLlmModel}".`);
      const newAnalysis = await prisma.analysis.create({
        data: { videoId: videoId, status: 'PENDING' },
      });
      runClaimExtractionProcess(newAnalysis.id, lastAnalysis.transcription, transcriptionProvider, withValidation, withFactChecking);
      const newAnalysisWithVideo = { ...newAnalysis, video: lastAnalysis.video };
      return { analysis: newAnalysisWithVideo, fromCache: false };
    }

    console.log(`Cache MISS: Lancement d'un nouveau processus réel complet.`);
    const video = await prisma.video.upsert({
      where: { id: videoId },
      update: {},
      create: { id: videoId, youtubeUrl },
    });
    const analysis = await prisma.analysis.create({
      data: { videoId: video.id, status: 'PENDING' },
    });
    runFullProcess(analysis.id, youtubeUrl, transcriptionProvider, withValidation, withFactChecking);
    const initialAnalysisWithVideo = { ...analysis, video: video };
    return { analysis: initialAnalysisWithVideo, fromCache: false };
  }
}

async function runFullProcess(analysisId, youtubeUrl, provider, withValidation, withFactChecking = false) {
    try {
        await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'FETCHING_METADATA' } });
        const metadata = await metadataService.getVideoMetadata(youtubeUrl);
        const videoId = transcriptionService.extractVideoId(youtubeUrl);
        await prisma.video.update({
            where: { id: videoId },
            data: {
                title: metadata.title,
                author: metadata.author,
                description: metadata.description,
                publishedAt: metadata.publishedAt,
                thumbnailUrl: metadata.thumbnailUrl,
            }
        });
        console.log("✅ Métadonnées récupérées avec succès.");
    } catch (error) {
        console.warn(`⚠️ Échec de la récupération des métadonnées (non-bloquant) : ${error.message}`);
        await prisma.analysis.update({
            where: { id: analysisId },
            data: { errorMessage: `Échec de la récupération des métadonnées : ${error.message}` }
        });
    }

    try {
        await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'TRANSCRIBING' } });
        const transcriptData = await transcriptionService.getTranscriptFromProvider(provider, youtubeUrl);
        const transcription = await prisma.transcription.create({
            data: {
                analysisId: analysisId,
                provider: provider,
                content: transcriptData,
                fullText: transcriptData.fullText,
            }
        });
        await runClaimExtractionProcess(analysisId, transcription, provider, withValidation, withFactChecking);
    } catch (criticalError) {
        console.error(`Échec critique du processus pour l'analyse ${analysisId}:`, criticalError.message);
        await prisma.analysis.update({
            where: { id: analysisId },
            data: { status: 'FAILED', errorMessage: `Erreur critique : ${criticalError.message}` }
        });
    }
}

async function runClaimExtractionProcess(analysisId, transcription, provider, withValidation, withFactChecking = false) {
  try {
    const currentLlmModel = provider === 'MOCK_PROVIDER'
      ? 'MOCK_PROVIDER'
      : process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";

    // Initialiser le statut et le progrès
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'EXTRACTING_CLAIMS',
        progress: 0
      }
    });
    
    let claimsData;
    if (provider === 'MOCK_PROVIDER') {
      claimsData = await claimExtractionService.mockExtractClaimsFromText();
      
      // Pour le mode mock, sauvegarder les claims traditionnellement
      if (claimsData.length > 0) {
        await prisma.claim.createMany({
          data: claimsData.map(claim => ({
            analysisId: analysisId,
            text: claim.text,
            timestamp: claim.timestamp,
          })),
        });
      }
    } else {
      // On lance la fonction, mais on ne stocke pas son résultat (qui est undefined)
      await claimExtractionService.extractClaimsWithTimestamps(
        analysisId,
        transcription.content,
        currentLlmModel
      );
    }

    // Récupérer les claims créés pour la validation (ils sont maintenant en base)
    const createdClaims = await prisma.claim.findMany({
      where: { analysisId },
      orderBy: { timestamp: 'asc' }
    });

    console.log(`🔎 ${createdClaims.length} affirmations au total ont été sauvegardées pour l'analyse ${analysisId}.`);

    if (withValidation && createdClaims.length > 0) {
      await runClaimValidationProcess(analysisId, createdClaims, transcription.content.paragraphs, provider);
    }

    // NOUVELLE ÉTAPE: Fact-checking des claims
    if (withFactChecking && createdClaims.length > 0) {
      let claimsToFactCheck;
      if (withValidation) {
        // Cas standard : on ne vérifie que les claims jugés valides
        // Récupérer les claims mis à jour après validation
        const updatedClaims = await prisma.claim.findMany({
          where: { analysisId },
          orderBy: { timestamp: 'asc' }
        });
        claimsToFactCheck = updatedClaims.filter(c => c.validationStatus === 'VALID');
        console.log(`🔍 Fact-checking activé: ${claimsToFactCheck.length} claims valides à vérifier sur ${updatedClaims.length} total`);
      } else {
        // Cas où la validation est désactivée : on vérifie tous les claims
        claimsToFactCheck = createdClaims;
        console.log(`🔍 Fact-checking activé: ${claimsToFactCheck.length} claims à vérifier (validation désactivée)`);
      }

      if (claimsToFactCheck.length > 0) {
        // Lancer le processus de fact-checking sur les claims filtrés
        await factCheckingService.runFactCheckingForAnalysis(analysisId, claimsToFactCheck);
      } else {
        console.log(`ℹ️ Aucun claim à fact-checker pour l'analyse ${analysisId}`);
      }
    }
    
    // Générer le rapport final via le service dédié
    await reportService.generateAndSaveFinalReport(analysisId);
    
    // Finaliser l'analyse
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'COMPLETE',
        llmModel: currentLlmModel,
        progress: 100
      }
    });
    console.log(`Analyse ${analysisId} terminée avec succès.`);
  } catch (error) {
    console.error(`Échec du processus d'extraction ou de validation pour l'analyse ${analysisId}:`, error);
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'FAILED',
        errorMessage: `Erreur critique : ${error.message}`,
        progress: 0
      }
    });
  }
}

/**
 * Nouvelle fonction pour orchestrer la validation des claims par chunks
 * @param {number} analysisId - ID de l'analyse
 * @param {Array} claims - Liste des claims à valider
 * @param {Array} paragraphs - Paragraphes de la transcription
 * @param {string} provider - Provider utilisé (pour le mode mock)
 */
async function runClaimValidationProcess(analysisId, claims, paragraphs, provider) {
  console.log(`🔍 Début de la validation par chunks pour ${claims.length} claims`);
  
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      status: 'VALIDATING_CLAIMS',
      progress: 0
    }
  });

  if (provider === 'MOCK_PROVIDER') {
    // Mode mock : utiliser l'ancienne logique
    console.log('Mode MOCK_PROVIDER: Utilisation de la validation simulée');
    
    const validationReport = [];
    for (const claim of claims) {
      const { validationResult, usedContext } = await mockValidateClaim(claim);
      
      validationReport.push({
        claim_text: claim.text,
        original_context: usedContext,
        validation_result: validationResult,
      });

      await prisma.claim.update({
        where: { id: claim.id },
        data: {
          validationStatus: validationResult.validationStatus,
          validationExplanation: validationResult.explanation,
          validationScore: validationResult.validationScore,
        }
      });
    }

    debugLogService.log(
      analysisId,
      '3_validation_report.json',
      JSON.stringify(validationReport, null, 2)
    );
    
    console.log("✅ Validation simulée terminée.");
    return;
  }

  // Mode réel : nouvelle logique par chunks
  const chunkSize = parseInt(process.env.CHUNK_SIZE) || 4;
  const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP) || 1;
  
  // Recréer les mêmes chunks que pour l'extraction
  const chunks = chunkTranscript(paragraphs, chunkSize, chunkOverlap);
  const validationModel = process.env.VALIDATION_MODEL || "mistralai/mistral-7b-instruct:free";
  
  console.log(`📦 ${chunks.length} chunks générés pour la validation`);

  const allValidationResults = [];
  const limit = parseInt(process.env.CONCURRENT_CHUNK_LIMIT) || 3;
  let processedChunks = 0;
  
  console.log(`🚀 Validation par lots avec une limite de ${limit} chunks simultanés`);

  // Créer un tableau de tâches (une tâche par chunk avec des claims)
  const tasks = chunks
    .map(chunk => {
      const claimsInChunk = getClaimsForChunk(claims, chunk);
      if (claimsInChunk.length === 0) {
        return null; // Pas de tâche pour les chunks sans claims
      }
      
      return async () => {
        console.log(`🔍 Chunk ${chunk.id}: Validation de ${claimsInChunk.length} claims (${chunk.startTime}s - ${chunk.endTime}s)`);

        try {
          // Valider tous les claims de ce chunk en une seule fois
          const chunkValidationResults = await validateClaimsChunk(claimsInChunk, chunk.text, validationModel);
          
          // Sauvegarder les résultats pour ce chunk
          const chunkReport = {
            chunkId: chunk.id,
            chunkTimeRange: `${chunk.startTime}s - ${chunk.endTime}s`,
            claimsValidated: claimsInChunk.length,
            validationResults: chunkValidationResults,
            chunkContext: chunk.text
          };

          debugLogService.log(
            analysisId,
            'report.json',
            JSON.stringify(chunkReport, null, 2),
            `validation/chunk_${chunk.id}`
          );

          // Mettre à jour la base de données pour tous les claims de ce chunk
          for (const result of chunkValidationResults) {
            await prisma.claim.update({
              where: { id: result.claimId },
              data: {
                validationStatus: result.validationStatus,
                validationExplanation: result.explanation,
                validationScore: result.validationScore,
              }
            });
          }

          console.log(`✅ Chunk ${chunk.id}: ${chunkValidationResults.length} validations terminées`);
          return chunkValidationResults;

        } catch (error) {
          console.error(`❌ Erreur lors de la validation du chunk ${chunk.id}:`, error.message);
          
          // Créer des résultats d'erreur pour tous les claims de ce chunk
          const errorResults = claimsInChunk.map(claim => ({
            claimId: claim.id,
            validationStatus: 'INACCURATE',
            explanation: `Erreur lors de la validation du chunk: ${error.message}`,
            validationScore: 0
          }));

          // Mettre à jour la base de données même en cas d'erreur
          for (const result of errorResults) {
            await prisma.claim.update({
              where: { id: result.claimId },
              data: {
                validationStatus: result.validationStatus,
                validationExplanation: result.explanation,
                validationScore: result.validationScore,
              }
            });
          }

          return errorResults;
        }
      };
    })
    .filter(task => task !== null); // Supprimer les tâches nulles

  console.log(`📦 ${tasks.length} chunks avec des claims à valider`);

  // Traiter les tâches par lots avec suivi du progrès
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    const batchNumber = Math.floor(i / limit) + 1;
    const totalBatches = Math.ceil(tasks.length / limit);
    
    console.log(`📦 Validation du lot ${batchNumber}/${totalBatches} (${batch.length} chunks)`);
    
    try {
      const batchResults = await Promise.all(batch.map(task => task()));
      
      // Agréger les résultats de ce lot
      for (const chunkResults of batchResults) {
        allValidationResults.push(...chunkResults);
      }
      
      processedChunks += batch.length;
      
      // Calculer et mettre à jour le progrès de validation
      const validationProgress = Math.round((processedChunks / tasks.length) * 100);
      
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: processedChunks < tasks.length ? 'PARTIALLY_COMPLETE' : 'VALIDATING_CLAIMS',
          progress: validationProgress
        }
      });
      
      console.log(`✅ Lot de validation ${batchNumber} terminé - Progrès: ${processedChunks}/${tasks.length} chunks (${validationProgress}%)`);
      
      // Petite pause entre les lots pour ménager l'API
      if (i + limit < tasks.length) {
        await sleep(1000);
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors du traitement du lot de validation ${batchNumber}:`, error.message);
      // Continuer avec les autres lots même en cas d'erreur
      processedChunks += batch.length;
    }
  }

  // Créer un rapport de validation global
  const globalValidationReport = {
    totalClaims: claims.length,
    totalChunks: chunks.length,
    validationModel: validationModel,
    validationTimestamp: new Date().toISOString(),
    results: allValidationResults.map(result => {
      const claim = claims.find(c => c.id === result.claimId);
      return {
        claim_text: claim?.text || 'Claim non trouvé',
        claim_timestamp: claim?.timestamp || 0,
        validation_result: {
          validationStatus: result.validationStatus,
          explanation: result.explanation,
          validationScore: result.validationScore
        }
      };
    })
  };

  debugLogService.log(
    analysisId,
    '3_validation_report.json',
    JSON.stringify(globalValidationReport, null, 2)
  );

  console.log(`✅ Validation par chunks terminée: ${allValidationResults.length} claims validés`);
}


async function rerunClaimExtraction(analysisId, withValidation, withFactChecking = false) {
  console.log(`RE-ANALYSE manuelle des claims pour l'analyse ID: ${analysisId}, validation: ${withValidation}, fact-checking: ${withFactChecking}`);
  
  const analysisToRerun = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: {
      transcription: true,
      video: true,
      claims: { orderBy: { timestamp: 'asc' } }
    },
  });

  if (!analysisToRerun || !analysisToRerun.transcription) {
    throw new Error("Impossible de relancer : l'analyse ou sa transcription n'existe pas.");
  }
  
  await prisma.claim.deleteMany({
    where: { analysisId: analysisId },
  });

  const updatedAnalysis = await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: 'PENDING' }
  });

  runClaimExtractionProcess(analysisId, analysisToRerun.transcription, analysisToRerun.transcription.provider, withValidation, withFactChecking);

  const updatedAnalysisWithVideo = {
    ...updatedAnalysis,
    video: analysisToRerun.video
  };
  return updatedAnalysisWithVideo;
}

module.exports = { startAnalysis, getAnalysisById, rerunClaimExtraction };