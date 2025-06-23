const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { spawn } = require("child_process");
const claimExtractionService = require("./claimExtractionService");
const { validateClaimsChunk, validateClaim, mockValidateClaim } = require("./claimValidationService");
const { chunkTranscript, getClaimsForChunk } = require("../utils/chunkUtils");
const fs = require('fs');
const path = require('path');
const debugLogService = require('./debugLogService');

const prisma = require("../client");

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const API_ENDPOINT = "https://api.assemblyai.com/v2";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractVideoId(url) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function getVideoMetadata(youtubeUrl) {
    return new Promise((resolve, reject) => {
        console.log("Récupération des métadonnées de la vidéo...");
        const ytDlpProcess = spawn('yt-dlp', ['--dump-json', '-o', '-', youtubeUrl]);

        let outputData = "";
        let errorMessages = "";

        ytDlpProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        ytDlpProcess.stderr.on('data', (data) => {
            outputData += data.toString();
            errorMessages += data.toString();
        });

        ytDlpProcess.on('close', (code) => {
            if (!outputData.trim()) {
                return reject(new Error("Aucune donnée (stdout/stderr) reçue de yt-dlp pour les métadonnées."));
            }

            try {
                const jsonLines = outputData.trim().split('\n');
                let metadata = null;

                for (const line of jsonLines) {
                    try {
                        const parsedLine = JSON.parse(line);
                        if (typeof parsedLine === 'object' && parsedLine.title) {
                            metadata = parsedLine;
                            break;
                        }
                    } catch (lineError) {
                        continue;
                    }
                }

                if (!metadata) {
                    throw new Error("Impossible de trouver un objet JSON de métadonnées valide dans la sortie de yt-dlp.");
                }

                resolve({
                    title: metadata.title,
                    author: metadata.uploader || metadata.channel,
                    description: metadata.description,
                    publishedAt: metadata.upload_date ? new Date(metadata.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : null,
                    thumbnailUrl: metadata.thumbnail
                });
            } catch (error) {
                if (code !== 0) {
                     return reject(new Error(`yt-dlp a quitté avec le code ${code}. Erreur: ${errorMessages}`));
                }
                reject(new Error(`Erreur de parsing des métadonnées JSON : ${error.message}`));
            }
        });
    });
}

async function getTranscriptFromAssemblyAI(youtubeUrl) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error(
      "Clé d'API AssemblyAI (ASSEMBLYAI_API_KEY) non configurée."
    );
  }
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("L'ID de la vidéo n'a pas pu être extrait de l'URL fournie.");
  }
  const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  return new Promise((resolve, reject) => {
    console.log(`1/3 - Lancement de yt-dlp pour l'URL sécurisée: ${cleanUrl}`);
    const ytDlpProcess = spawn('yt-dlp', ['-f', 'bestaudio', '-x', '--audio-format', 'mp3', '-o', '-', cleanUrl]);

    let stderr = "";
    ytDlpProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytDlpProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`yt-dlp a quitté avec le code ${code}. Erreur: ${stderr}`);
        reject(new Error("Le téléchargement de l'audio depuis YouTube a échoué."));
      }
    });

    console.log("2/3 - Upload du flux audio vers AssemblyAI...");
    axios
      .post(`${API_ENDPOINT}/upload`, ytDlpProcess.stdout, {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "Transfer-Encoding": "chunked",
        },
      })
      .then((uploadResponse) => {
        const { upload_url } = uploadResponse.data;
        console.log(`Upload réussi. URL temporaire de l'audio : ${upload_url}`);
        console.log("3/3 - Soumission de l'audio pour transcription...");
        return axios.post(`${API_ENDPOINT}/transcript`, { audio_url: upload_url, language_detection: true }, { headers: { authorization: ASSEMBLYAI_API_KEY } });
      })
      .then(async (submitResponse) => {
        const { id: transcriptId } = submitResponse.data;
        while (true) {
          console.log(`Vérification du statut (ID: ${transcriptId})...`);
          await sleep(5000);
          const getResponse = await axios.get(`${API_ENDPOINT}/transcript/${transcriptId}`, { headers: { authorization: ASSEMBLYAI_API_KEY } });
          const { status, error } = getResponse.data;
          if (status === "completed") {
            console.log("✅ Transcription terminée !");
            const paragraphResponse = await axios.get(`${API_ENDPOINT}/transcript/${transcriptId}/paragraphs`, { headers: { authorization: ASSEMBLYAI_API_KEY } });
            resolve({
              fullText: getResponse.data.text,
              words: getResponse.data.words,
              paragraphs: paragraphResponse.data.paragraphs
            });
            return;
          } else if (status === "failed") {
            reject(new Error(`Le service de transcription a échoué. Raison: ${error}`));
            return;
          }
        }
      })
      .catch((err) => {
        console.error("Erreur dans le processus de transcription AssemblyAI:", err.message);
        reject(new Error("Échec de la communication avec le service de transcription."));
      });
  });
}

async function getTranscriptFromProvider(provider, youtubeUrl) {
  if (provider === "ASSEMBLY_AI")
    return getTranscriptFromAssemblyAI(youtubeUrl);
  if (provider === "MOCK_PROVIDER") return getTranscriptFromMockProvider();
  throw new Error(`Fournisseur non supporté: "${provider}"`);
}

async function getTranscriptFromMockProvider() {
  console.log("MOCK_PROVIDER: Démarrage de la transcription simulée.");
  const existingTranscriptions = await prisma.transcription.findMany({
    where: { fullText: { not: null } },
  });

  if (existingTranscriptions.length === 0) {
    console.error("MOCK_PROVIDER: Aucune transcription existante à utiliser. Veuillez d'abord lancer une vraie analyse.");
    throw new Error("Le mode de test nécessite au moins une transcription réelle dans la base de données.");
  }

  const randomIndex = Math.floor(Math.random() * existingTranscriptions.length);
  const mockData = existingTranscriptions[randomIndex];
  console.log(`MOCK_PROVIDER: Utilisation de la transcription existante ID: ${mockData.id}`);
  await sleep(3000);
  console.log("MOCK_PROVIDER: ✅ Transcription simulée terminée !");
  return {
    fullText: mockData.fullText,
    words: mockData.content.words,
    paragraphs: mockData.content.paragraphs
  };
}

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
  const videoId = extractVideoId(youtubeUrl);
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
        const metadata = await getVideoMetadata(youtubeUrl);
        const videoId = extractVideoId(youtubeUrl);
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
        const transcriptData = await getTranscriptFromProvider(provider, youtubeUrl);
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

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Trouver tous les claims qui appartiennent à ce chunk
    const claimsInChunk = getClaimsForChunk(claims, chunk);
    
    if (claimsInChunk.length === 0) {
      console.log(`⏭️ Chunk ${chunk.id}: Aucun claim à valider`);
      continue;
    }

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

      allValidationResults.push(...chunkValidationResults);
      console.log(`✅ Chunk ${chunk.id}: ${chunkValidationResults.length} validations terminées`);

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

      allValidationResults.push(...errorResults);
    }

    // Petite pause entre les chunks pour ménager l'API
    if (i < chunks.length - 1) {
      await sleep(1000);
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
 * Génère un rapport final exhaustif de l'analyse
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
        paragraphsCount: completeAnalysis.transcription?.content?.paragraphs?.length || 0
      },
      claims: {
        total: completeAnalysis.claims.length,
        byStatus: completeAnalysis.claims.reduce((acc, claim) => {
          const status = claim.validationStatus || 'NOT_VALIDATED';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
        details: completeAnalysis.claims.map(claim => ({
          id: claim.id,
          text: claim.text,
          timestamp: claim.timestamp,
          validationStatus: claim.validationStatus,
          validationExplanation: claim.validationExplanation,
          validationScore: claim.validationScore
        }))
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