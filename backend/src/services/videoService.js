const { PrismaClient } = require("@prisma/client");
const claimExtractionService = require("./claimExtractionService");
const { validateClaimsChunk, mockValidateClaim } = require("./claimValidationService");
const { chunkTranscript, getClaimsForChunk } = require("../utils/chunkUtils");
const debugLogService = require('./debugLogService');
const metadataService = require('./metadataService');
const transcriptionService = require('./transcriptionService');

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

async function startAnalysis(youtubeUrl, transcriptionProvider, withValidation) {
  console.log(`Début de l'analyse pour l'URL: ${youtubeUrl} avec le fournisseur: ${transcriptionProvider}, validation: ${withValidation}`);
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
    runFullProcess(analysis.id, youtubeUrl, transcriptionProvider, withValidation);
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
      runClaimExtractionProcess(newAnalysis.id, lastAnalysis.transcription, transcriptionProvider, true);
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
    runFullProcess(analysis.id, youtubeUrl, transcriptionProvider, withValidation);
    const initialAnalysisWithVideo = { ...analysis, video: video };
    return { analysis: initialAnalysisWithVideo, fromCache: false };
  }
}

async function runFullProcess(analysisId, youtubeUrl, provider, withValidation) {
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
        await runClaimExtractionProcess(analysisId, transcription, provider, withValidation);
    } catch (criticalError) {
        console.error(`Échec critique du processus pour l'analyse ${analysisId}:`, criticalError.message);
        await prisma.analysis.update({
            where: { id: analysisId },
            data: { status: 'FAILED', errorMessage: `Erreur critique : ${criticalError.message}` }
        });
    }
}

async function runClaimExtractionProcess(analysisId, transcription, provider, withValidation) {
  try {
    const currentLlmModel = provider === 'MOCK_PROVIDER'
      ? 'MOCK_PROVIDER'
      : process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct:free";

    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'EXTRACTING_CLAIMS' } });
    
    let claimsData;
    if (provider === 'MOCK_PROVIDER') {
      claimsData = await claimExtractionService.mockExtractClaimsFromText();
    } else {
      claimsData = await claimExtractionService.extractClaimsWithTimestamps(
        analysisId,
        transcription.content,
        currentLlmModel
      );
    }
    
    console.log(`${claimsData.length} affirmations extraites avec le modèle ${currentLlmModel}.`);
    if (claimsData.length > 0) {
      await prisma.claim.createMany({
        data: claimsData.map(claim => ({
          analysisId: analysisId,
          text: claim.text,
          timestamp: claim.timestamp,
        })),
      });
    }

    // Récupérer les claims créés pour la validation
    const createdClaims = await prisma.claim.findMany({
      where: { analysisId },
      orderBy: { timestamp: 'asc' }
    });

    if (withValidation && createdClaims.length > 0) {
      await runClaimValidationProcess(analysisId, createdClaims, transcription.content.paragraphs, provider);
    }
    
    // Générer le rapport final
    await generateFinalReport(analysisId);
    
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'COMPLETE', llmModel: currentLlmModel }
    });
    console.log(`Analyse ${analysisId} terminée avec succès.`);
  } catch (error) {
    console.error(`Échec du processus d'extraction ou de validation pour l'analyse ${analysisId}:`, error);
    await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'FAILED', errorMessage: `Erreur critique : ${error.message}` } });
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
  
  await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'VALIDATING_CLAIMS' } });

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

  // Traiter les tâches par lots
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
      
      console.log(`✅ Lot de validation ${batchNumber} terminé`);
      
      // Petite pause entre les lots pour ménager l'API
      if (i + limit < tasks.length) {
        await sleep(1000);
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors du traitement du lot de validation ${batchNumber}:`, error.message);
      // Continuer avec les autres lots même en cas d'erreur
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

/**
 * Trouve le paragraphe source d'un claim basé sur son timestamp.
 * Retourne le paragraphe lui-même et un contexte de +/- 1 paragraphe.
 * @param {object} claim - L'objet claim avec un timestamp.
 * @param {Array} paragraphs - La liste de tous les paragraphes de la transcription.
 * @returns {{sourceParagraph: object, fullContext: string}|null}
 */
function findClaimContext(claim, paragraphs) {
  if (!paragraphs || paragraphs.length === 0) return null;

  let bestMatchIndex = -1;
  // Trouve le dernier paragraphe qui commence AVANT ou EGAL au timestamp du claim.
  for (let i = 0; i < paragraphs.length; i++) {
    const paraStartSeconds = paragraphs[i].start / 1000;
    if (paraStartSeconds <= claim.timestamp) {
      bestMatchIndex = i;
    } else {
      break;
    }
  }

  if (bestMatchIndex === -1) return null;

  const contextSlices = [];
  // Paragraphe précédent
  if (bestMatchIndex > 0) {
    contextSlices.push(`[${bestMatchIndex - 1}] ${paragraphs[bestMatchIndex - 1].text}`);
  }
  // Paragraphe principal
  contextSlices.push(`[${bestMatchIndex}] (Source) ${paragraphs[bestMatchIndex].text}`);
  // Paragraphe suivant
  if (bestMatchIndex < paragraphs.length - 1) {
    contextSlices.push(`[${bestMatchIndex + 1}] ${paragraphs[bestMatchIndex + 1].text}`);
  }

  return {
    sourceParagraph: {
      index: bestMatchIndex,
      ...paragraphs[bestMatchIndex]
    },
    fullContext: contextSlices.join('\n\n---\n\n')
  };
}

/**
 * Génère un rapport final exhaustif de l'analyse, incluant le contexte des claims
 * et exporte la transcription complète.
 * @param {number} analysisId - ID de l'analyse
 */
async function generateFinalReport(analysisId) {
  console.log(`📋 Génération du rapport final pour l'analyse ${analysisId}`);
  
  try {
    // Récupérer toutes les données de l'analyse avec les relations
    const completeAnalysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        video: true,
        transcription: true,
        claims: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!completeAnalysis) {
      throw new Error(`Analyse ${analysisId} non trouvée`);
    }

    const allParagraphs = completeAnalysis.transcription?.content?.paragraphs || [];

    // NOUVELLE ÉTAPE : Sauvegarder la transcription complète dans un fichier texte
    if (completeAnalysis.transcription?.fullText) {
        debugLogService.log(
            analysisId,
            'full_transcript.txt',
            completeAnalysis.transcription.fullText
        );
        console.log(`[DEBUG] Transcription complète sauvegardée pour l'analyse ${analysisId}`);
    }

    // Construire le rapport final
    const finalReport = {
      analysis: {
        id: completeAnalysis.id,
        status: completeAnalysis.status,
        llmModel: completeAnalysis.llmModel,
        createdAt: completeAnalysis.createdAt,
        updatedAt: completeAnalysis.updatedAt,
        errorMessage: completeAnalysis.errorMessage
      },
      video: {
        id: completeAnalysis.video.id,
        youtubeUrl: completeAnalysis.video.youtubeUrl,
        title: completeAnalysis.video.title,
        author: completeAnalysis.video.author,
        description: completeAnalysis.video.description,
        publishedAt: completeAnalysis.video.publishedAt,
        thumbnailUrl: completeAnalysis.video.thumbnailUrl
      },
      transcription: {
        id: completeAnalysis.transcription?.id,
        provider: completeAnalysis.transcription?.provider,
        fullTextLength: completeAnalysis.transcription?.fullText?.length || 0,
        paragraphsCount: allParagraphs.length
      },
      claims: {
        total: completeAnalysis.claims.length,
        byStatus: completeAnalysis.claims.reduce((acc, claim) => {
          const status = claim.validationStatus || 'NOT_VALIDATED';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
        details: completeAnalysis.claims.map(claim => {
            // NOUVELLE ÉTAPE : Trouver le contexte pour chaque claim
            const contextInfo = findClaimContext(claim, allParagraphs);
            
            return {
              id: claim.id,
              text: claim.text,
              timestamp: claim.timestamp,
              // AJOUT DU CONTEXTE
              context: {
                sourceParagraphIndex: contextInfo?.sourceParagraph?.index ?? null,
                fullContextText: contextInfo?.fullContext ?? "Contexte introuvable."
              },
              validationStatus: claim.validationStatus,
              validationExplanation: claim.validationExplanation,
              validationScore: claim.validationScore
            };
        })
      },
      summary: {
        extractionModel: completeAnalysis.llmModel,
        validationModel: process.env.VALIDATION_MODEL || null,
        chunkSize: parseInt(process.env.CHUNK_SIZE) || null,
        chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || null,
        reportGeneratedAt: new Date().toISOString()
      }
    };

    // Sauvegarder le rapport final
    debugLogService.log(
      analysisId,
      'final_analysis_report.json',
      JSON.stringify(finalReport, null, 2)
    );

    console.log(`✅ Rapport final généré avec succès pour l'analyse ${analysisId}`);

  } catch (error) {
    console.error(`❌ Erreur lors de la génération du rapport final:`, error.message);
    
    // Sauvegarder un rapport d'erreur minimal
    const errorReport = {
      analysisId: analysisId,
      error: error.message,
      reportGeneratedAt: new Date().toISOString()
    };

    debugLogService.log(
      analysisId,
      'final_analysis_report_ERROR.json',
      JSON.stringify(errorReport, null, 2)
    );
  }
}

async function rerunClaimExtraction(analysisId, withValidation) {
  console.log(`RE-ANALYSE manuelle des claims pour l'analyse ID: ${analysisId}, validation: ${withValidation}`);
  
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

  runClaimExtractionProcess(analysisId, analysisToRerun.transcription, analysisToRerun.transcription.provider, withValidation);

  const updatedAnalysisWithVideo = {
    ...updatedAnalysis,
    video: analysisToRerun.video
  };
  return updatedAnalysisWithVideo;
}

module.exports = { startAnalysis, getAnalysisById, rerunClaimExtraction };